import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fixture,account,testServer,httpClient} from './helpers.mjs';
import {createCellsService} from '../server/cells/service.mjs';
import {ageStatistics} from '../server/cells/repository.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {createUser} from '../server/identity/service.mjs';
import {blankCell,validateCell,cellFields} from '../src/domain/cell.js';
import {blankPerson} from '../src/domain/person.js';
import {birthdayInfo} from '../src/domain/birthday.js';
import {cellDTO} from '../server/leader/projection.mjs';
const all={all:true,ids:[]},none={all:false,ids:[]};
const input=extra=>({...blankCell(),groupCode:'T',openedDate:'2026-01-01',...extra});
const editable=c=>Object.fromEntries(cellFields.map(f=>[f.key,c[f.key]]));
async function setup(t){const f=await fixture();t.after(()=>f.close());const user=await account(f),ctx={user:await principal(f.pool,user.id)},s=createCellsService(f.pool);return {f,user,ctx,s};}

test('Territorio: validación de coordenadas, edades, verificación y radio sin coerción',()=>{
 for(const extra of [{latitude:91,longitude:0},{latitude:0,longitude:-181},{latitude:0},{longitude:0},{latitude:NaN,longitude:0},{latitude:Infinity,longitude:0},{latitude:'1',longitude:2},{coordinateStatus:'VERIFIED'},{recommendedAgeMin:-1},{recommendedAgeMin:2.5},{recommendedAgeMin:30,recommendedAgeMax:20},{ageUnrestricted:true,recommendedAgeMin:1},{ageUnrestricted:'true'},{coverageRadiusMeters:0},{coverageRadiusMeters:-1},{coverageRadiusMeters:100001},{coverageRadiusMeters:Infinity}])assert.ok(Object.keys(validateCell(input(extra)).errors).length,JSON.stringify(extra));
 for(const extra of [{},{latitude:0,longitude:0},{latitude:-90,longitude:180,coordinateStatus:'VERIFIED'},{recommendedAgeMin:0,recommendedAgeMax:99},{ageUnrestricted:true},{recommendedAgeMin:18},{coverageRadiusMeters:0.5},{coverageRadiusMeters:100000}])assert.deepEqual(validateCell(input(extra)).errors,{});
 assert.equal(validateCell(input({latitude:0,longitude:0})).cell.coordinateStatus,'PENDING');
});

test('Territorio: migración aditiva preserva filas previas sin inventar geografía ni clasificación',async t=>{
 const {f,ctx,s}=await setup(t),c=await s.save({cell:input({address:'Lugar existente'})},ctx);
 // Recreate only the pre-014 column shape inside this disposable test database.
 await f.pool.query(`ALTER TABLE cells DROP CONSTRAINT cells_coordinate_pair,
 DROP COLUMN country, DROP COLUMN "coordinateStatus", DROP COLUMN "locationUpdatedAt",
 DROP COLUMN "recommendedAgeMin", DROP COLUMN "recommendedAgeMax", DROP COLUMN "ageUnrestricted", DROP COLUMN "coverageRadiusMeters"`);
 await f.pool.query('UPDATE cells SET latitude=95 WHERE id=$1',[c.id]);
 const before=(await f.pool.query('SELECT * FROM cells WHERE id=$1',[c.id])).rows[0];
 await f.pool.query(await readFile(new URL('../server/db/migrations/014_cell_territory.sql',import.meta.url),'utf8'));
 const after=await s.get(c.id);for(const key of Object.keys(before))assert.deepEqual(after[key],before[key],key);
 assert.equal(after.coordinateStatus,null);assert.equal(after.country,null);assert.equal(after.locationUpdatedAt,null);
 assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM cell_events WHERE "cellId"=$1',[c.id])).rows[0].n,1);
});

test('Territorio: persistencia opcional, auditoría, reverificación y compatibilidad de clientes anteriores',async t=>{
 const {f,user,ctx,s}=await setup(t);let c=await s.save({cell:input()},ctx);
 for(const key of ['country','latitude','longitude','coordinateStatus','locationUpdatedAt','recommendedAgeMin','coverageRadiusMeters'])assert.equal(c[key],null,key);
 c=await s.save({cell:editable({...c,address:'Lugar habitual',country:'Argentina',latitude:-34.6,longitude:-58.4,coordinateStatus:'VERIFIED',recommendedAgeMin:18,recommendedAgeMax:35,coverageRadiusMeters:750}),version:c.version},{...ctx,id:c.id});
 assert.equal(c.coordinateStatus,'VERIFIED');assert.ok(c.locationUpdatedAt);
 let audit=(await f.pool.query("SELECT * FROM audit_events WHERE action='CELL_UPDATE' ORDER BY occurred_at DESC LIMIT 1")).rows[0];
 assert.equal(audit.actor_id,user.id);assert.equal(audit.entity_id,c.id);assert.ok(audit.changes.some(x=>x.field==='latitude'&&x.before===null&&x.after===-34.6));assert.ok(audit.changes.some(x=>x.field==='coverageRadiusMeters'));
 c=await s.save({cell:editable({...c,address:'Otra dirección'}),version:c.version},{...ctx,id:c.id});assert.equal(c.coordinateStatus,'PENDING');
 c=await s.save({cell:editable({...c,coordinateStatus:'VERIFIED'}),version:c.version},{...ctx,id:c.id});assert.equal(c.coordinateStatus,'VERIFIED');
 const legacy=editable({...c,notes:'Edición anterior'});for(const key of ['country','latitude','longitude','coordinateStatus','recommendedAgeMin','recommendedAgeMax','ageUnrestricted','coverageRadiusMeters'])delete legacy[key];
 c=await s.save({cell:legacy,version:c.version},{...ctx,id:c.id});assert.equal(c.latitude,-34.6);assert.equal(c.coordinateStatus,'VERIFIED');assert.equal(c.recommendedAgeMin,18);
 const expected=cellDTO(c);assert.deepEqual(Object.keys(expected),['id','displayCode','meetingDay','meetingTime']);
 await assert.rejects(()=>f.pool.query('UPDATE cells SET latitude=91 WHERE id=$1',[c.id]),e=>e.code==='23514');
 await assert.rejects(()=>f.pool.query('UPDATE cells SET longitude=NULL WHERE id=$1',[c.id]),e=>e.code==='23514');
 await assert.rejects(()=>f.pool.query('UPDATE cells SET "coverageRadiusMeters"=\'NaN\' WHERE id=$1',[c.id]),e=>e.code==='23514');
 c=await s.save({cell:editable({...c,latitude:null,longitude:null,coordinateStatus:null,recommendedAgeMin:null,recommendedAgeMax:null,ageUnrestricted:true}),version:c.version},{...ctx,id:c.id});assert.equal(c.latitude,null);assert.equal(c.ageUnrestricted,true);
});

test('Territorio: composición ordinaria vigente, cumpleaños, bisiestos, desconocidos y privacidad',async t=>{
 const {f,user,ctx,s}=await setup(t),c=await s.save({cell:input()},ctx);let n=0;
 async function member(birthDate,role='MEMBER',start='2026-01-01'){
  const p=await f.people.save({...blankPerson(),names:'Persona',lastNames:'Territorio '+String.fromCharCode(65+n++),birthDate:birthDate||''},{actorId:user.id,acknowledgeDuplicates:true});
  await s.move(c.id,{kind:'ASSIGN',personId:p.id,role,date:start,version:(await s.get(c.id)).version},ctx);return p;
 }
 const dates=['2000-10-21','2000-10-22','2004-02-29',null];for(const birth of dates)await member(birth);
 await member('1940-01-01','LEADER');await member('1950-01-01','ASSISTANT');const ended=await member('1930-01-01');
 const m=(await s.personHistory(ended.id,{},all)).current;await s.move(c.id,{kind:'END',personId:ended.id,membershipId:m.id,date:'2026-02-01',version:(await s.get(c.id)).version},ctx);
 let stats=await ageStatistics(f.pool,c.id,all,'2026-10-21');assert.deepEqual(stats,{minimum:22,maximum:26,average:24.3,known:3,unknown:1,asOf:'2026-10-21',population:'MEMBER'});
 assert.equal(await ageStatistics(f.pool,c.id,none,'2026-10-21'),null);
 for(const date of ['2026-02-27','2026-02-28','2026-03-01','2026-10-20','2026-10-22']){
  stats=await ageStatistics(f.pool,c.id,all,date);const ages=dates.filter(Boolean).map(d=>birthdayInfo(d,date).age);assert.equal(stats.minimum,Math.min(...ages));assert.equal(stats.maximum,Math.max(...ages));assert.equal(stats.average,Math.round(ages.reduce((a,b)=>a+b,0)/ages.length*10)/10);
 }
 stats=await ageStatistics(f.pool,c.id,all,'2025-12-31');assert.equal(stats.known,0);assert.equal(stats.average,null);
});

test('Territorio: API exige consulta/edición, respeta alcance y no revela estadísticas personales',async t=>{
 const {f,user,ctx,s}=await setup(t),c=await s.save({cell:input({address:'Dirección privada',latitude:0,longitude:0})},ctx),server=await testServer(f);t.after(()=>server.close());
 const client=httpClient(server.base);assert.equal((await client.request('/api/cells/'+c.id)).status,401);await client.login(user);
 const profile=await (await client.request('/api/cells/'+c.id)).json();assert.equal(profile.latitude,0);assert.equal(profile.ageStatistics.known,0);
 const roleId=randomUUID();await f.pool.query('INSERT INTO roles VALUES($1,$2)',[roleId,'Lectura territorial']);await f.pool.query("INSERT INTO role_permissions VALUES($1,'celulas.ver')",[roleId]);
 // Use a known test password, never demo credentials.
 const password=randomUUID()+randomUUID(),other=await createUser(f.pool,{username:'territory.'+randomUUID(),password,grants:[{roleId,scopeType:'cell',scopeId:c.id}]});const scoped=httpClient(server.base);await scoped.login({...other,password});
 assert.equal((await scoped.request('/api/cells/'+c.id)).status,200);
 const p=await f.people.save({...blankPerson(),names:'Persona',lastNames:'Privada',birthDate:'1990-01-01'},{actorId:user.id,acknowledgeDuplicates:true});
 await s.move(c.id,{kind:'ASSIGN',personId:p.id,role:'MEMBER',date:'2026-01-01',version:c.version},ctx);
 assert.equal((await (await scoped.request('/api/cells/'+c.id)).json()).ageStatistics,null);
 assert.equal((await scoped.request('/api/cells/'+c.id,{method:'PUT',body:JSON.stringify({cell:editable(c),version:c.version})})).status,403);
 assert.equal((await scoped.request('/api/cells/'+randomUUID())).status,404);
 const noAccess=await account(f,[]),denied=httpClient(server.base);await denied.login(noAccess);assert.equal((await denied.request('/api/cells/'+c.id)).status,403);
});
