import {fixture,testServer,account,httpClient} from './helpers.mjs';
import {createPool} from '../server/db/pool.mjs';
import {createPeopleService} from '../server/people/service.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankPerson,completeness,completenessFields,validatePerson} from '../src/domain/person.js';
const sample=overrides=>({...blankPerson(),names:'Ágata Demo',lastNames:'Ejemplo',...overrides});
const actor={actorId:'system:test-demo'};
const editInput=person=>Object.fromEntries(Object.keys(blankPerson()).map(key=>[key,person[key]]));
test('Validaciones: mínimos, incompletos, tipos, fechas, email, teléfono y campos no admitidos',async(t)=>{
 assert.deepEqual(validatePerson(sample()).errors,{});
 for(const invalid of [{names:''},{lastNames:'123'},{email:'incorrecto'},{phone:'abc'},{birthDate:'2025-02-30'},{birthDate:'2999-01-01'},{joinedDate:'1900-01-01',birthDate:'2000-01-01'},{status:'NUEVO'},{sex:'INVALIDO'},{names:55},{admin:true},{notes:'x'.repeat(4001)}]) assert.ok(Object.keys(validatePerson(sample(invalid)).errors).length,JSON.stringify(invalid));
 const info=completeness(sample());assert.equal(info.percent,25);assert.deepEqual(info.missing,completenessFields.filter(key=>!['names','lastNames'].includes(key)));
});
test('Alta, persistencia, edición, concurrencia, eventos y auditoría separada',async(t)=>{
 const f=await fixture();let reopened;t.after(async()=>{if(reopened)await reopened.end();await f.close();});let store=f.people;
 let person=await store.save(sample(),actor);
 assert.match(person.id,/^[\da-f-]{36}$/);assert.equal(person.document,null);
 assert.equal((await store.history(person.id)).items[0].type,'person.created');
 reopened=createPool({databaseUrl:f.url});store=createPeopleService(reopened);
 assert.equal((await store.get(person.id)).names,'Ágata Demo');
 const original=person;
 person=await store.save({...editInput(person),phone:'000 000 111',address:'Calle Demo',status:'INACTIVA'},{...actor,id:person.id,version:person.version});
 assert.equal(person.version,2);assert.equal(person.completeness.percent,50);
 const events=(await store.history(person.id)).items;
 assert.equal(events.length,4);
 assert.ok(events.some(item=>item.type==='person.contact.updated'));
 assert.ok(events.some(item=>item.type==='person.address.updated'));
 assert.ok(events.some(item=>item.type==='person.status.changed'));
 await assert.rejects(()=> store.save({...editInput(original),notes:'stale'},{...actor,id:person.id,version:1}),error=>error.details.code==='VERSION_CONFLICT');
 await store.save(editInput(person),{...actor,id:person.id,version:2});assert.equal((await store.history(person.id)).items.length,4);
 const audit=(await f.pool.query('SELECT changes FROM audit_events ORDER BY sequence DESC')).rows;
 assert.equal(audit.length,2);assert.deepEqual(audit[0].changes.find(change=>change.field==='status'),{field:'status',before:'ACTIVA',after:'INACTIVA'});
 assert.equal(Number((await f.pool.query('SELECT count(*) AS n FROM schema_migrations')).rows[0].n),19);
});
test('Documento único normalizado, documento opcional y posibles coincidencias',async(t)=>{
 const f=await fixture();t.after(()=>f.close());const store=f.people;
 try {
  const a=await store.save(sample({document:'DEMO-12.345'}),actor);
  await assert.rejects(()=> store.save(sample({names:'Otra Demo',document:'demo12345'}),actor),error=>error.details.code==='DUPLICATE_DOCUMENT');
  await assert.rejects(()=> store.save(sample({document:'DISTINTO'}),actor),error=>error.details.code==='POSSIBLE_DUPLICATE'&&error.details.matches[0].id===a.id);
  await store.save(sample(),{...actor,acknowledgeDuplicates:true});
  await store.save(sample({names:'Otra Demo'}),actor);
  assert.equal((await store.list()).total,3);
 }finally{}
});
test('Búsqueda normalizada, filtros, orden estable y paginación del servidor',async(t)=>{
 const f=await fixture();t.after(()=>f.close());const store=f.people;
 try {
  await store.save(sample({document:'DEMO-001',phone:'+00 000 111 222',locality:'Zona Norte',sex:'MUJER'}),actor);
  await store.save(sample({names:'Beatriz Demo',lastNames:'Zeta',status:'INACTIVA',locality:'Zona Sur',sex:'MUJER',document:'DEMO-002',birthDate:'1990-03-02',phone:'000000999',email:'test@example.invalid',address:'Calle Demo'}),actor);
  assert.equal((await store.list({q:'AGATA EJEMPLO'})).total,1);assert.equal((await store.list({q:'ejemplo agata'})).total,1);
  assert.equal((await store.list({q:'000111222'})).total,1);assert.equal((await store.list({q:'+00 000 111'})).total,1);
  assert.equal((await store.list({q:'DEMO-001'})).total,1);
  assert.equal((await store.list({status:'INACTIVA'})).total,1);assert.equal((await store.list({sex:'HOMBRE'})).total,0);
  assert.equal((await store.list({locality:'ZONA NORTE'})).total,1);
  assert.equal((await store.list({completeness:'complete'})).total,1);assert.equal((await store.list({completeness:'incomplete'})).total,1);
  const first=await store.list({pageSize:1});const second=await store.list({pageSize:1,page:2});assert.notEqual(first.items[0].id,second.items[0].id);assert.equal(first.pages,2);
  assert.equal((await store.list({direction:'desc'})).items[0].lastNames,'Zeta');
  assert.equal((await store.list({page:999,pageSize:1})).page,2);
  assert.equal((await store.list({q:"' OR 1=1 --",sort:'DROP TABLE people'})).total,0);
  assert.equal((await store.list({q:'%'})).total,0);assert.equal((await store.list()).total,2);
 }finally{}
});
test('Una falla en historial revierte persona y auditoría en la misma transacción',async(t)=>{
 const f=await fixture();t.after(()=>f.close());const store=f.people;
 await f.pool.query("CREATE FUNCTION reject_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END; $$; CREATE TRIGGER reject_event BEFORE INSERT ON person_events FOR EACH ROW EXECUTE FUNCTION reject_event();");
 await assert.rejects(()=>store.save(sample(),actor));assert.equal((await store.list()).total,0);assert.equal(Number((await f.pool.query('SELECT count(*) AS n FROM audit_events')).rows[0].n),0);
});
test('API: persistencia, validación autoritativa, origen, archivos privados y permisos',async(t)=>{
 const f=await fixture();const s=await testServer(f);t.after(async()=>{await s.close();await f.close();});
 const user=await account(f);const c=httpClient(s.base);await c.login(user);
 const save=(person,headers={})=>c.request('/api/people',{method:'POST',headers,body:JSON.stringify({person})});
 assert.equal((await save(sample({email:'bad'}))).status,422);
 assert.equal((await save(sample(),{Origin:'http://foreign.invalid'})).status,403);
 const created=await save(sample());assert.equal(created.status,201);const person=await created.json();
 assert.equal(person.capabilities.edit,true);assert.equal(person.documentKey,undefined);
 assert.equal((await (await c.request('/api/people/'+person.id)).json()).id,person.id);
 const edit=await c.request('/api/people/'+person.id,{method:'PUT',body:JSON.stringify({person:sample({phone:'000000123'}),version:1})});assert.equal(edit.status,200);
 assert.equal((await (await c.request('/api/people/'+person.id+'/history')).json()).total,2);
 assert.equal((await c.request('/api/people/'+person.id,{method:'DELETE'})).status,405);
 for(const path of ['/data/erp.sqlite','/server/people-store.mjs','/.git/config'])assert.equal((await c.request(path)).status,404);
 assert.equal((await c.request('/api/people',{method:'POST',body:'{bad'})).status,400);
 await f.pool.query("DELETE FROM role_permissions WHERE role_id=$1 AND permission!='personas.ver'",[user.roleId]);
 assert.equal((await save(sample())).status,403);
 assert.equal((await (await c.request('/api/people/'+person.id)).json()).capabilities.edit,false);
 assert.equal((await c.request('/api/people/'+person.id+'/history')).status,403);
 await f.pool.query('DELETE FROM user_roles WHERE user_id=$1',[user.id]);
 assert.equal((await c.request('/api/people')).status,403);assert.equal((await save(sample())).status,403);
});
