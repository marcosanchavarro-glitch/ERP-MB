import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,account,testServer,httpClient} from './helpers.mjs';
import {createCellsService} from '../server/cells/service.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {blankCell} from '../src/domain/cell.js';
import {blankPerson,fields} from '../src/domain/person.js';
import {createUser} from '../server/identity/service.mjs';
import {confirmedPersonLocation,personAddressFingerprint} from '../server/territory/recommendations.mjs';

test('Ubicación personal: verificación vinculada al domicilio, cero válido y cambios invalidan',()=>{
 const p={address:'Calle 123',locality:'Centro',province:'Buenos Aires'};
 p.geoLocation={latitude:0,longitude:0,verification:{accuracy:'MANUAL'},addressFingerprint:personAddressFingerprint(p)};
 assert.ok(confirmedPersonLocation(p));assert.ok(confirmedPersonLocation({...p,address:' CALLE  123 '}));
 for(const change of [{address:'Otra'},{locality:'Otra'},{province:'Otra'},{municipality:'Otra'},{postalCode:'1234'},{geoLocation:{...p.geoLocation,latitude:NaN}},{geoLocation:{...p.geoLocation,verification:null}}])assert.equal(confirmedPersonLocation({...p,...change}),null);
});

test('Recomendaciones: SQL limitado, edad, sexo, distancia real, faltantes, auditoría y privacidad',async t=>{
 const f=await fixture();t.after(()=>f.close());const user=await account(f),ctx={user:await principal(f.pool,user.id)},cells=createCellsService(f.pool),server=await testServer(f);t.after(()=>server.close());
 let p=await f.people.save({...blankPerson(),names:'Prueba',lastNames:'Territorial',birthDate:'2000-01-01',sex:'HOMBRE',address:'Calle 123',locality:'Centro',province:'Buenos Aires'},{actorId:user.id});
 const make=async(generation,extra={})=>cells.save({cell:{...blankCell(),groupCode:'R',generation,gender:'M',openedDate:'2020-01-01',recommendedAgeMin:18,recommendedAgeMax:40,latitude:0,longitude:0,coordinateStatus:'VERIFIED',...extra}},ctx);
 const far=await make(1,{longitude:1}),near=await make(2),alternative=await make(3,{recommendedAgeMin:60,recommendedAgeMax:80}),female=await make(4,{gender:'F'}),closed=await make(5),pending=await make(6,{coordinateStatus:'PENDING'});
 await f.pool.query(`UPDATE cells SET status='CLOSED',"closedDate"='2026-01-01' WHERE id=$1`,[closed.id]);
 const endpoint='/api/territory/recommendations/'+p.id,client=httpClient(server.base);
 assert.equal((await client.request(endpoint)).status,401);await client.login(user);
 let r=await (await client.request(endpoint)).json();assert.equal(r.items.length,3);assert.equal(r.location,null);assert.ok(r.items.every(c=>c.distanceMeters===null));assert.ok(!r.items.some(c=>[female.id,closed.id].includes(c.id)));
 const payload={latitude:0,longitude:0,country:'Argentina',version:p.version,confirmation:{manual:true}};
 assert.equal((await client.request(endpoint+'/location',{method:'PUT',body:JSON.stringify({...payload,confirmation:{manual:false}})})).status,422);
 assert.equal((await client.request(endpoint+'/location',{method:'PUT',body:JSON.stringify({...payload,latitude:91})})).status,422);
 assert.equal((await client.request(endpoint+'/location',{method:'PUT',headers:{'X-CSRF-Token':''},body:JSON.stringify(payload)})).status,403);
 assert.equal((await client.request(endpoint+'/location',{method:'PUT',body:JSON.stringify(payload)})).status,200);
 assert.equal((await client.request(endpoint+'/location',{method:'PUT',body:JSON.stringify(payload)})).status,409);
 r=await (await client.request(endpoint)).json();assert.equal(r.person.age>=26,true);assert.deepEqual(r.items.map(c=>c.id),[near.id,far.id,pending.id]);assert.equal(r.items[0].distanceMeters,0);assert.ok(Math.abs(r.items[1].distanceMeters-111195.08)<0.1);assert.equal(r.items[2].distanceMeters,null);assert.equal(r.items[2].canMap,false);assert.equal(r.referralAvailable,false);
 const ordinary=await (await client.request('/api/people/'+p.id)).json();assert.equal(ordinary.geoLocation,undefined);assert.equal(ordinary.capabilities.recommendations,true);
 const audit=(await f.pool.query("SELECT * FROM audit_events WHERE action='PERSON_LOCATION_UPDATE'")).rows;assert.equal(audit.length,1);assert.equal(audit[0].actor_id,user.id);assert.equal(audit[0].entity_id,p.id);assert.ok(audit[0].context.requestId);
 assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM cell_memberships')).rows[0].n,0);
 // Removing compatible cells leaves a clearly labelled alternative, never padded results.
 await f.pool.query(`UPDATE cells SET status='CLOSED',"closedDate"='2026-01-01' WHERE id=ANY($1::uuid[])`,[[near.id,far.id,pending.id]]);
 r=await (await client.request(endpoint)).json();assert.equal(r.items.length,1);assert.equal(r.items[0].id,alternative.id);assert.equal(r.items[0].ageCompatibility,'ALTERNATIVE');
 p=await f.people.get(p.id);const input=Object.fromEntries(fields.map(({key})=>[key,p[key]??'']));p=await f.people.save({...input,address:'Otro domicilio',birthDate:'',sex:''},{id:p.id,version:p.version,actorId:user.id});
 r=await (await client.request(endpoint)).json();assert.equal(r.location,null);assert.equal(r.person.age,null);assert.equal(r.items[0].distanceMeters,null);assert.equal(r.items[0].ageCompatibility,'UNKNOWN');assert.equal(r.items[0].genderCompatibility,'UNKNOWN');
 await f.pool.query(`UPDATE cells SET status='CLOSED',"closedDate"='2026-01-01' WHERE status='ACTIVE'`);assert.deepEqual((await (await client.request(endpoint)).json()).items,[]);
 // Scoped user sees only their person and cell. Knowing UUIDs never grants access.
 const password=randomUUID()+randomUUID(),limited=await createUser(f.pool,{username:'limited.'+randomUUID(),password,grants:[]});
 const scopedCell=await make(7);await make(8);
 for(const [permission,type,id] of [['modulos.acceder','subarea','oficina-personas'],['modulos.acceder','subarea','territorio-mapa'],['personas.ver','person',p.id],['celulas.ver','cell',scopedCell.id]])await f.pool.query('INSERT INTO user_permissions(id,user_id,permission,scope_type,scope_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),limited.id,permission,type,id]);
 const scoped=httpClient(server.base);await scoped.login({...limited,password});
 r=await (await scoped.request(endpoint)).json();assert.deepEqual(r.items.map(c=>c.id),[scopedCell.id]);assert.equal(r.canEditLocation,false);
 assert.equal((await scoped.request('/api/territory/recommendations/'+randomUUID())).status,404);
 assert.equal((await scoped.request(endpoint+'/location',{method:'PUT',body:JSON.stringify(payload)})).status,403);
 await f.pool.query("DELETE FROM user_permissions WHERE user_id=$1 AND scope_id='oficina-personas'",[limited.id]);
 assert.equal((await scoped.request(endpoint)).status,403);
 await f.pool.query("INSERT INTO user_permissions(id,user_id,permission,scope_type,scope_id) VALUES($1,$2,'modulos.acceder','subarea','oficina-personas')",[randomUUID(),limited.id]);
 await f.pool.query("DELETE FROM user_permissions WHERE user_id=$1 AND scope_id='territorio-mapa'",[limited.id]);
 assert.equal((await scoped.request(endpoint)).status,403);assert.equal((await (await scoped.request('/api/people/'+p.id)).json()).capabilities.recommendations,false);
 assert.equal((await client.request('/api/locations/search/person/'+p.id,{method:'POST',body:JSON.stringify({address:'Calle 123',locality:'Centro',province:'Buenos Aires',country:'Argentina'})})).status,404);
});
