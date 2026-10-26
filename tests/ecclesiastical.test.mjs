import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {grantRuntime} from '../server/db/runtime-grants.mjs';
import {fixture,account,httpClient,testServer} from './helpers.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {publicUser} from '../server/identity/presentation.mjs';
import {blankPerson} from '../src/domain/person.js';
import {officeCatalog,currentOffice,officeProfile,changeOffice,administrativeOffices} from '../server/people/ecclesiastical.mjs';
const names=['Apóstol','Pastor interno','Anciano mayor','Anciano medio','Anciano','Líder celular','Líder areal','Asistente','Miembro'];
async function setup(t){const f=await fixture();t.after(()=>f.close());const user=await account(f),actor=await principal(f.pool,user.id);const person=await f.people.save({...blankPerson(),names:'Persona',lastNames:'Ejemplo'},{actorId:user.id});return {f,user,actor,person};}
const input=(officeId='MEMBER',expectedId=null,extra={})=>({officeId,effectiveDate:'2026-01-01',expectedId,operationId:randomUUID(),confirmed:true,reason:'Confirmación administrativa',...extra});
test('Cargos: operación con rol SQL restringido sin escritura en catálogo ni historial',async()=>{
 const f=await fixture(),role='erp_test_'+randomUUID().replaceAll('-','');let runtime;
 try{const user=await account(f),actor=await principal(f.pool,user.id),person=await f.people.save({...blankPerson(),names:'Prueba',lastNames:'Runtime'},{actorId:user.id});await f.pool.query(`CREATE ROLE ${role} NOLOGIN`);await grantRuntime(f.pool,role);runtime=new pg.Pool({connectionString:f.url,options:'-c role='+role});await changeOffice(runtime,person.id,input(),actor,'runtime');assert.equal((await officeProfile(runtime,person.id,actor)).current.officeId,'MEMBER');assert.equal((await administrativeOffices(runtime,actor)).items.length,9);await assert.rejects(()=>runtime.query('UPDATE ecclesiastical_appointments SET reason=reason'),e=>e.code==='42501');await assert.rejects(()=>runtime.query('UPDATE ecclesiastical_offices SET name=name'),e=>e.code==='42501');}
 finally{await runtime?.end();await f.pool.query(`DROP OWNED BY ${role}`);await f.pool.query(`DROP ROLE ${role}`);await f.close();}
});
test('Cargos: nueve identificadores estables, orden oficial y catálogo inmutable',async t=>{
 const {f}=await setup(t),catalog=await officeCatalog(f.pool);assert.deepEqual(catalog.map(c=>c.name),names);assert.deepEqual(catalog.map(c=>c.order),[1,2,3,4,5,6,7,8,9]);assert.equal(new Set(catalog.map(c=>c.id)).size,9);
 await assert.rejects(()=>f.pool.query("UPDATE ecclesiastical_offices SET hierarchy_order=10 WHERE id='MEMBER'"));await assert.rejects(()=>f.pool.query("INSERT INTO ecclesiastical_offices VALUES('OTHER','Otro',10,true)"));await assert.rejects(()=>f.pool.query("DELETE FROM ecclesiastical_offices WHERE id='MEMBER'"));
});
test('Cargos: sin backfill, visitante sin cargo y Miembro solo en nueva incorporación explícita',async t=>{
 const {f,user,person}=await setup(t);assert.equal(await currentOffice(f.pool,person.id),null);
 const member=await f.people.save({...blankPerson(),names:'Miembro',lastNames:'Nuevo',joinedDate:'2026-01-01'},{actorId:user.id});assert.equal((await currentOffice(f.pool,member.id)).officeId,'MEMBER');
 const edit=Object.fromEntries(Object.keys(blankPerson()).map(k=>[k,person[k]||'']));await f.people.save({...edit,joinedDate:'2026-01-01'},{id:person.id,version:person.version,actorId:user.id});assert.equal(await currentOffice(f.pool,person.id),null);
 assert.equal((await f.pool.query("SELECT count(*)::int n FROM audit_events WHERE action='ECCLESIASTICAL_OFFICE_ASSIGN'")).rows[0].n,1);
});
test('Cargos: asignación/cambio, mismo día, idempotencia, períodos e historial auditados sin roles ni liderazgo',async t=>{
 const {f,person,actor}=await setup(t),roles=(await f.pool.query('SELECT * FROM user_roles ORDER BY id')).rows,firstInput=input();const first=await changeOffice(f.pool,person.id,firstInput,actor,'initial');
 assert.equal((await changeOffice(f.pool,person.id,firstInput,actor,'retry')).id,first.id);
 await changeOffice(f.pool,person.id,input('ASSISTANT',first.id),actor,'second');let data=await officeProfile(f.pool,person.id,actor);assert.equal(data.current.officeId,'ASSISTANT');assert.equal(data.history.total,2);assert.equal(data.history.items[1].endDate,'2026-01-01');assert.equal(data.history.items[0].previousName,'Miembro');
 const third=await changeOffice(f.pool,person.id,input('CELL_LEADER',data.current.id,{effectiveDate:'2026-02-01'}),actor,'third');data=await officeProfile(f.pool,person.id,actor);assert.equal(data.current.id,third.id);assert.equal(data.history.items[0].endDate,null);assert.equal(data.history.items[1].endDate,'2026-02-01');
 assert.deepEqual((await f.pool.query('SELECT * FROM user_roles ORDER BY id')).rows,roles);assert.equal((await f.pool.query('SELECT count(*)::int n FROM cell_memberships')).rows[0].n,0);
 const audit=(await f.pool.query("SELECT changes FROM audit_events WHERE action='ECCLESIASTICAL_OFFICE_CHANGE' ORDER BY sequence DESC")).rows;assert.equal(audit.length,2);assert.equal(audit[0].changes[0].before.officeId,'ASSISTANT');assert.equal(audit[0].changes[0].after.officeId,'CELL_LEADER');
 await assert.rejects(()=>f.pool.query('UPDATE ecclesiastical_appointments SET reason=$1 WHERE id=$2',['Manipulado',first.id]));await assert.rejects(()=>f.pool.query('DELETE FROM ecclesiastical_appointments WHERE id=$1',[first.id]));
 assert.equal((await f.people.list({office:'CELL_LEADER'})).total,1);assert.equal((await f.people.list({office:'MEMBER'})).total,0);assert.equal((await f.people.list({office:'NONE'})).total,0);
});
test('Cargos: validaciones, conflictos concurrentes, integridad y rollback de auditoría',async t=>{
 const {f,person,actor}=await setup(t);for(const bad of [{officeId:'UNKNOWN'},{effectiveDate:'2026-02-30'},{effectiveDate:'2999-01-01'},{confirmed:false},{reason:44},{reason:'\0'},{roleId:randomUUID()}])await assert.rejects(()=>changeOffice(f.pool,person.id,input('MEMBER',null,bad),actor,'bad'),e=>e.status===422);
 const results=await Promise.allSettled([changeOffice(f.pool,person.id,input(),actor,'a'),changeOffice(f.pool,person.id,input('ELDER'),actor,'b')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
 const before=await currentOffice(f.pool,person.id);await assert.rejects(()=>changeOffice(f.pool,person.id,input('APOSTLE',before.id,{effectiveDate:'2025-12-31'}),actor,'bad'),e=>e.status===422);
 await f.pool.query("ALTER TABLE audit_events ADD CONSTRAINT test_office_audit_failure CHECK(action<>'ECCLESIASTICAL_OFFICE_CHANGE') NOT VALID");await assert.rejects(()=>changeOffice(f.pool,person.id,input('APOSTLE',before.id),actor,'rollback'));assert.equal((await currentOffice(f.pool,person.id)).id,before.id);
 await assert.rejects(()=>f.pool.query("INSERT INTO ecclesiastical_appointments(person_id,office_id,effective_date,actor_id,operation_id,fingerprint) VALUES($1,'MEMBER','2026-01-01','test',$2,'x')",[randomUUID(),randomUUID()]),e=>e.code==='23503');
});
test('Cargos: filtros combinados, conteos reales y paginación del historial',async t=>{
 const {f,person,actor,user}=await setup(t);let id=null;for(let i=0;i<22;i++){const changed=await changeOffice(f.pool,person.id,input(i%2?'ASSISTANT':'MEMBER',id,{effectiveDate:`2026-01-${String(i+1).padStart(2,'0')}`}),actor,'page');id=changed.id;}
 const data=await officeProfile(f.pool,person.id,actor,2);assert.equal(data.history.page,2);assert.equal(data.history.items.length,2);assert.equal(data.history.total,22);
 await f.people.save({...blankPerson(),names:'Otra',lastNames:'Persona'},{actorId:user.id});assert.equal((await f.people.list({office:'NONE'})).total,1);assert.equal((await f.people.list({office:'ASSISTANT',q:'Persona',status:'ACTIVA'})).total,1);
 const admin=await administrativeOffices(f.pool,actor);assert.equal(admin.items.find(o=>o.id==='ASSISTANT').count,1);assert.equal(admin.items.find(o=>o.id==='MEMBER').count,0);
 await assert.rejects(()=>f.people.list({office:'BAD'}),e=>e.status===422);
});
test('Cargos HTTP: permisos existentes, alcance personal, CSRF, historia privada y separación del rol técnico',async t=>{
 const {f,person,actor}=await setup(t),server=await testServer(f);t.after(()=>server.close());const client=httpClient(server.base);assert.equal((await client.request(`/api/people/${person.id}/ecclesiastical-office`)).status,401);
 const reader=await account(f,[]);for(const [permission,scope,id]of [['personas.ver','person',person.id],['personas.editar','person',person.id],['admin.usuarios.ver','global',null]])await f.pool.query('INSERT INTO user_permissions(id,user_id,permission,scope_type,scope_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),reader.id,permission,scope,id]);
 await client.login(reader);const base=`/api/people/${person.id}/ecclesiastical-office`;const data=await (await client.request(base)).json();assert.equal(data.history,null);assert.equal(data.canManage,false);
 assert.equal((await client.request(base,{method:'POST',body:JSON.stringify(input())})).status,403);assert.equal((await client.request('/api/people/'+randomUUID()+'/ecclesiastical-office')).status,404);
 await f.pool.query("INSERT INTO user_permissions(id,user_id,permission,scope_type) VALUES($1,$2,'admin.usuarios.gestionar','global')",[randomUUID(),reader.id]);assert.equal((await client.request(base,{method:'POST',headers:{'X-CSRF-Token':''},body:JSON.stringify(input())})).status,403);
 assert.equal((await client.request(base,{method:'POST',body:JSON.stringify(input('APOSTLE'))})).status,200);const principalAfter=await principal(f.pool,reader.id);assert.ok(!principalAfter.grants.some(g=>g.permission==='modulos.acceder'));assert.ok(!publicUser(principalAfter).access.allModules);
 const catalog=await (await client.request('/api/people/ecclesiastical-offices')).json();assert.equal(catalog.limited,true);assert.equal(catalog.items.find(o=>o.id==='APOSTLE').count,1);
 await f.pool.query("DELETE FROM user_permissions WHERE user_id=$1 AND permission='admin.usuarios.gestionar'",[reader.id]);assert.equal((await client.request(base,{method:'POST',body:JSON.stringify(input('MEMBER'))})).status,403);
 assert.equal((await administrativeOffices(f.pool,actor)).items.length,9);
});
