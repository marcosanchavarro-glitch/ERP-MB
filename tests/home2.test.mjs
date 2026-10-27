import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,account,testServer,httpClient} from './helpers.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {createHomeService} from '../server/home/service.mjs';
import {blankPerson} from '../src/domain/person.js';
import {assignOrganization} from '../server/people/organization.mjs';
import {saveDepartmentActivity} from '../server/departments/service.mjs';
import {calendarAdd} from '../src/domain/calendar.js';
import {installationToday} from '../server/core/calendar.mjs';
import {attendanceFixture} from './attendance2-fixture.mjs';
import {leaderRole} from '../server/identity/leader-accounts.mjs';
import {grantRuntime} from '../server/db/runtime-grants.mjs';
async function setup(t){const f=await fixture();t.after(()=>f.close());const user=await account(f),actor=await principal(f.pool,user.id),home=createHomeService(f.pool);return {f,user,actor,home};}
async function grant(f,user,permission,type='global',id=null){await f.pool.query('INSERT INTO user_permissions(id,user_id,permission,scope_type,scope_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),user.id,permission,type,id]);}
test('Inicio 2: autenticación, validación, mínimos y cero real no son error',async t=>{
 const {f,actor,home}=await setup(t);await assert.rejects(()=>home({},null),e=>e.status===401);await assert.rejects(()=>home({userId:actor.id},actor),e=>e.status===422);await assert.rejects(()=>home({source:['office']},actor),e=>e.status===422);
 const bare=await account(f,[]),data=await home({},await principal(f.pool,bare.id));assert.deepEqual(data.sources,{});assert.deepEqual(data.quick,[]);assert.deepEqual(data.personal,[]);
 const full=await home({},actor);assert.equal(full.sources.indicators.data.items[0].count,0);assert.equal(full.sources.indicators.status,'ok');assert.equal(full.sources.departments.data.count,13);assert.deepEqual(full.sources.departments.data.upcoming,[]);assert.ok(!JSON.stringify(full).includes('permission'));
});
test('Inicio 2: cifras personales restringidas, oficinista y eventos seguros',async t=>{
 const {f,user,actor,home}=await setup(t),p=await f.people.save({...blankPerson(),names:'Visible',lastNames:'Persona',notes:'SECRET_PERSON'},{actorId:user.id});await f.people.save({...blankPerson(),names:'Otra',lastNames:'Privada'},{actorId:user.id});
 const reader=await account(f,[]);await grant(f,reader,'personas.ver','person',p.id);let result=await home({},await principal(f.pool,reader.id));assert.equal(result.sources.indicators.data.items[0].count,1);assert.equal(result.sources.indicators.data.items.length,1);assert.deepEqual(result.sources.office.data.activity,[]);assert.ok(!result.sources.departments);assert.ok(!JSON.stringify(result).includes('SECRET_PERSON'));
 await grant(f,reader,'personas.historial','person',p.id);result=await home({},await principal(f.pool,reader.id));assert.ok(result.sources.office.data.activity.length>0);assert.ok(result.sources.office.data.activity.every(e=>e.path==='/oficina/personas/'+p.id));
 const office=await account(f,[]);await grant(f,office,'oficina.contactos.ver');const work=await home({},await principal(f.pool,office.id));assert.ok(work.personal.some(a=>a.path==='/oficina/trabajo'));assert.ok(!work.sources.indicators);assert.ok(!work.sources.departments);assert.ok((await home({},actor)).sources.indicators.data.items[0].count===2);
});
test('Inicio 2: departamentos exactos, próximos/recientes reales y revocación',async t=>{
 const {f,user,actor,home}=await setup(t),units=(await f.pool.query("SELECT id,catalog_key FROM organizational_units WHERE catalog_key IN('multimedia','recepcion')")).rows,mm=units.find(u=>u.catalog_key==='multimedia').id,rec=units.find(u=>u.catalog_key==='recepcion').id,p=await f.people.save({...blankPerson(),names:'Equipo',lastNames:'Prueba'},{actorId:user.id});
 for(const id of [mm,rec]){await assignOrganization(f.pool,p.id,{unitId:id,responsibility:'Integrante',isResponsible:false,startDate:'2025-01-01',operationId:randomUUID()},actor);await saveDepartmentActivity(f.pool,id,null,{title:id===mm?'Actividad visible':'SECRET_OTHER_DEPT',date:calendarAdd(installationToday(),1),time:'12:00',responsibleId:p.id,participantIds:[p.id],notes:'SECRET_NOTE',operationId:randomUUID()},actor);}
 const reader=await account(f,[]);await grant(f,reader,'departamentos.ver','area',mm);const result=await home({},await principal(f.pool,reader.id));assert.deepEqual(Object.keys(result.sources),['departments']);const d=result.sources.departments.data;assert.equal(d.count,1);assert.equal(d.upcomingCount,1);assert.equal(d.upcoming[0].title,'Actividad visible');assert.equal(d.recent.length,1);assert.ok(!JSON.stringify(result).match(/SECRET|participant|responsible/));assert.ok(!result.quick.some(q=>q.path==='/oficina/personas'));
 await f.pool.query('DELETE FROM user_permissions WHERE user_id=$1',[reader.id]);const revoked=await home({source:'departments'},await principal(f.pool,reader.id));assert.deepEqual(revoked.sources,{});assert.deepEqual(revoked.quick,[]);
});
test('Inicio 2: fallos parciales, consulta limitada y sin N+1 ni fuentes ajenas',async t=>{
 const {f,actor}=await setup(t),calls=[],broken={query:async(sql,values)=>{calls.push(sql);if(sql.startsWith('WITH units'))throw Object.assign(new Error('SECRET_DATABASE_FAILURE'),{code:'TEST_FAILURE'});return f.pool.query(sql,values);},connect:()=>f.pool.connect()};
 const result=await createHomeService(broken)({},actor,{requestId:'test-reference'});assert.equal(result.sources.departments.status,'error');assert.equal(result.sources.indicators.status,'ok');assert.equal(result.sources.office.status,'ok');assert.equal(calls.length,3);assert.ok(!JSON.stringify(result).includes('SECRET_DATABASE_FAILURE'));
 calls.length=0;await createHomeService(broken)({source:'indicators'},actor);assert.equal(calls.length,1);
 const bare=await account(f,[]);calls.length=0;await createHomeService(broken)({},await principal(f.pool,bare.id));assert.equal(calls.length,0);
});
test('Inicio 2: líder solo consulta sus células, sin generar reuniones ni otorgar acceso Matriz',async t=>{
 const x=await attendanceFixture();t.after(()=>x.f.close());await x.cells.move(x.a.id,{kind:'ASSIGN',personId:x.p.id,role:'LEADER',date:'2026-10-01',version:(await x.cells.get(x.a.id)).version},x.ctx);const roleId=await leaderRole(x.f.pool),user=await account(x.f,[{roleId,scopeType:'global'}]);await x.f.pool.query('UPDATE users SET person_id=$2 WHERE id=$1',[user.id,x.p.id]);
 const before=(await x.f.pool.query('SELECT count(*) FROM cell_meetings')).rows[0].count,result=await createHomeService(x.f.pool)({},await principal(x.f.pool,user.id));assert.deepEqual(Object.keys(result.sources),['leader']);assert.equal(result.sources.leader.data.items.length,1);assert.equal(result.sources.leader.data.items[0].id,x.a.id);assert.equal(result.sources.leader.data.items[0].members,2);assert.equal((await x.f.pool.query('SELECT count(*) FROM cell_meetings')).rows[0].count,before);assert.ok(!result.quick.some(a=>a.path==='/oficina/personas'));
});
test('Inicio 2: HTTP privado, alcance del servidor y rol SQL mínimo',async t=>{
 const {f,user}=await setup(t),server=await testServer(f),client=httpClient(server.base);assert.equal((await client.request('/api/home')).status,401);await client.login(user);let response=await client.request('/api/home');assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal((await client.request('/api/home?source=unknown')).status,422);
 const role='home_'+randomUUID().replaceAll('-','');await f.pool.query('CREATE ROLE '+role);await grantRuntime(f.pool,role);const db=await f.pool.connect();try{await db.query('SET ROLE '+role);const result=await createHomeService({query:(...args)=>db.query(...args),connect:()=>{throw new Error('No leader');}})({},await principal(f.pool,user.id));assert.ok(Object.values(result.sources).every(s=>s.status==='ok'));}finally{await db.query('RESET ROLE');db.release();await f.pool.query('DROP OWNED BY '+role);await f.pool.query('DROP ROLE '+role);}
});
