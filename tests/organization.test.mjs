import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {fixture,account,httpClient,testServer} from './helpers.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {publicUser} from '../server/identity/presentation.mjs';
import {grantRuntime} from '../server/db/runtime-grants.mjs';
import {blankPerson} from '../src/domain/person.js';
import {navigation} from '../src/config.js';
import {saveOrganizationalUnit,listOrganizationalUnits,organizationalUnitDetail,personOrganization,assignOrganization,updateOrganizationAssignment} from '../server/people/organization.mjs';
async function setup(t){const f=await fixture();t.after(()=>f.close());const user=await account(f),actor=await principal(f.pool,user.id),people=[];for(const names of ['Una','Otra'])people.push(await f.people.save({...blankPerson(),names,lastNames:'Persona'},{actorId:user.id}));const units=(await f.pool.query('SELECT * FROM organizational_units')).rows;return {f,user,actor,people,unit:key=>units.find(u=>u.catalog_key===key)};}
const area=(extra={})=>({name:'Área de prueba',description:'Registro de prueba',active:true,parentId:null,operationId:randomUUID(),...extra});
const assignment=(unitId,extra={})=>({unitId,responsibility:'Coordinador',isResponsible:true,startDate:'2026-01-01',notes:'Confirmación de prueba',operationId:randomUUID(),...extra});
test('Organización: catálogo verificado, jerarquía sin ciclos, edición/desactivación e idempotencia',async t=>{
 const {f,actor,unit}=await setup(t);const config=new Set(navigation.flatMap(a=>[a.id,...a.children.map(c=>c.id)])),rows=(await f.pool.query('SELECT * FROM organizational_units')).rows;assert.equal(rows.length,13);for(const u of rows)assert.ok(config.has(u.catalog_key));assert.equal(unit('multimedia-fotografia').parent_id,unit('multimedia').id);
 const input=area(),a=await saveOrganizationalUnit(f.pool,null,input,actor);assert.deepEqual(await saveOrganizationalUnit(f.pool,null,input,actor),a);const b=await saveOrganizationalUnit(f.pool,null,area({name:'Subárea',parentId:a.id}),actor);
 await assert.rejects(()=>saveOrganizationalUnit(f.pool,a.id,area({parentId:b.id,version:a.version}),actor),e=>e.status===409);
 await assert.rejects(()=>saveOrganizationalUnit(f.pool,a.id,area({active:false,version:a.version}),actor),e=>e.status===409);
 const closed=await saveOrganizationalUnit(f.pool,b.id,area({name:'Subárea',active:false,parentId:a.id,version:b.version}),actor);assert.equal(closed.version,2);await saveOrganizationalUnit(f.pool,a.id,area({active:false,version:a.version}),actor);
 assert.equal((await organizationalUnitDetail(f.pool,b.id,actor)).unit.parent_id,a.id);await assert.rejects(()=>f.pool.query('DELETE FROM organizational_units WHERE id=$1',[b.id]));assert.equal((await listOrganizationalUnits(f.pool,{q:'Subárea',status:'inactive'},actor)).total,1);
});
test('Organización: múltiples áreas y responsables, sin duplicados ni cambios de cargo/roles/células',async t=>{
 const {f,actor,people,unit}=await setup(t),roles=(await f.pool.query('SELECT * FROM user_roles ORDER BY id')).rows,body=assignment(unit('multimedia').id);const a=await assignOrganization(f.pool,people[0].id,body,actor);assert.deepEqual(await assignOrganization(f.pool,people[0].id,body,actor),a);
 await assignOrganization(f.pool,people[1].id,assignment(unit('multimedia').id),actor);await assignOrganization(f.pool,people[0].id,assignment(unit('recepcion').id,{responsibility:'Colaborador',isResponsible:false}),actor);await assignOrganization(f.pool,people[0].id,assignment(unit('multimedia').id,{responsibility:'Integrante',isResponsible:false}),actor);
 await assert.rejects(()=>assignOrganization(f.pool,people[0].id,assignment(unit('multimedia').id,{responsibility:'COORDINADOR'}),actor),e=>e.status===409);
 const detail=await organizationalUnitDetail(f.pool,unit('multimedia').id,actor);assert.equal(detail.counts.members,2);assert.equal(detail.counts.responsibles,2);assert.equal((await personOrganization(f.pool,people[0].id,actor)).assignments.length,3);
 assert.deepEqual((await f.pool.query('SELECT * FROM user_roles ORDER BY id')).rows,roles);assert.equal((await f.pool.query('SELECT count(*)::int n FROM ecclesiastical_appointments')).rows[0].n,0);assert.equal((await f.pool.query('SELECT count(*)::int n FROM cell_memberships')).rows[0].n,0);
});
test('Organización: cambios y finalización conservan períodos, historial y auditoría',async t=>{
 const {f,actor,people,unit}=await setup(t),id=people[0].id,a=await assignOrganization(f.pool,id,assignment(unit('multimedia').id),actor);
 const b=await updateOrganizationAssignment(f.pool,id,a.id,{responsibility:'Responsable compartido',isResponsible:true,effectiveDate:'2026-02-01',notes:'Cambio confirmado',version:a.version,operationId:randomUUID()},actor);
 await updateOrganizationAssignment(f.pool,id,b.id,{endDate:'2026-03-01',version:b.version,operationId:randomUUID()},actor,true);
 const profile=await personOrganization(f.pool,id,actor);assert.equal(profile.assignments.length,2);assert.ok(profile.assignments.every(a=>a.end_date));assert.equal(profile.events.length,3);assert.equal(profile.assignments.find(a=>a.id===a.id)?.unit_name,'Multimedia');assert.equal((await organizationalUnitDetail(f.pool,unit('multimedia').id,actor)).counts.members,0);assert.equal((await organizationalUnitDetail(f.pool,unit('multimedia').id,actor,{participation:'history'})).total,2);
 await assert.rejects(()=>assignOrganization(f.pool,id,assignment(unit('multimedia').id,{startDate:'2026-01-15'}),actor),e=>e.status===409);await assignOrganization(f.pool,id,assignment(unit('multimedia').id,{startDate:'2026-03-02'}),actor);
 const audit=(await f.pool.query("SELECT changes FROM audit_events WHERE action='ORGANIZATION_RESPONSIBILITY_CHANGE'")).rows;assert.equal(audit[0].changes[0].before.responsibility,'Coordinador');assert.equal(audit[0].changes[0].after.responsibility,'Responsable compartido');
 await assert.rejects(()=>f.pool.query('UPDATE organizational_assignments SET notes=$1 WHERE id=$2',['Alterado',a.id]));await assert.rejects(()=>f.pool.query('DELETE FROM organizational_events'));assert.equal((await f.people.list({organizationUnit:unit('multimedia').id,participation:'current',responsibility:'coordinador',q:'Una'})).total,1);
});
test('Organización: concurrencia, rollback, validación, inactivas e integridad referencial',async t=>{
 const {f,actor,people,unit}=await setup(t),id=people[0].id;
 for(const bad of [{startDate:'2026-02-30'},{startDate:'2999-01-01'},{responsibility:''},{responsibility:55},{isResponsible:'sí'},{notes:'\0'}])await assert.rejects(()=>assignOrganization(f.pool,id,assignment(unit('multimedia').id,bad),actor),e=>e.status===422);
 const results=await Promise.allSettled([assignOrganization(f.pool,id,assignment(unit('multimedia').id),actor),assignOrganization(f.pool,id,assignment(unit('multimedia').id),actor)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
 const a=results.find(r=>r.status==='fulfilled').value;await assignOrganization(f.pool,id,assignment(unit('multimedia').id,{responsibility:'Integrante'}),actor);
 await assert.rejects(()=>updateOrganizationAssignment(f.pool,id,a.id,{responsibility:'Integrante',isResponsible:true,effectiveDate:'2026-02-01',notes:'',version:1,operationId:randomUUID()},actor),e=>e.status===409);assert.equal((await f.pool.query('SELECT end_date FROM organizational_assignments WHERE id=$1',[a.id])).rows[0].end_date,null);
 await f.pool.query("ALTER TABLE audit_events ADD CONSTRAINT reject_org_audit CHECK(action<>'ORGANIZATION_PARTICIPATION_END') NOT VALID");await assert.rejects(()=>updateOrganizationAssignment(f.pool,id,a.id,{endDate:'2026-03-01',version:1,operationId:randomUUID()},actor,true));assert.equal((await f.pool.query('SELECT version FROM organizational_assignments WHERE id=$1',[a.id])).rows[0].version,1);
 const inactive=await saveOrganizationalUnit(f.pool,null,area({active:false}),actor);await assert.rejects(()=>assignOrganization(f.pool,id,assignment(inactive.id),actor),e=>e.status===422);
 await assert.rejects(()=>assignOrganization(f.pool,randomUUID(),assignment(unit('recepcion').id),actor),e=>e.status===404);
 await assert.rejects(()=>f.pool.query("INSERT INTO organizational_assignments(person_id,unit_id,responsibility,responsibility_key,start_date,created_by) VALUES($1,$2,'Prueba','prueba','2026-01-01','test')",[randomUUID(),unit('recepcion').id]),e=>e.code==='23503');
});
test('Organización: ciclos concurrentes y filtros con paginación',async t=>{
 const {f,actor}=await setup(t),a=await saveOrganizationalUnit(f.pool,null,area({name:'Área A'}),actor),b=await saveOrganizationalUnit(f.pool,null,area({name:'Área B'}),actor);
 const results=await Promise.allSettled([saveOrganizationalUnit(f.pool,a.id,area({name:'Área A',parentId:b.id,version:1}),actor),saveOrganizationalUnit(f.pool,b.id,area({name:'Área B',parentId:a.id,version:1}),actor)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 for(let i=0;i<8;i++)await saveOrganizationalUnit(f.pool,null,area({name:'Adicional '+i}),actor);const data=await listOrganizationalUnits(f.pool,{page:'2'},actor);assert.equal(data.page,2);assert.equal(data.total,23);assert.equal(data.items.length,3);
});
test('Organización HTTP: alcance, historial protegido, CSRF, IDOR y permisos administrativos existentes',async t=>{
 const {f,actor,people,unit}=await setup(t),a=await assignOrganization(f.pool,people[0].id,assignment(unit('multimedia').id),actor);await assignOrganization(f.pool,people[1].id,assignment(unit('multimedia').id),actor);await updateOrganizationAssignment(f.pool,people[0].id,a.id,{endDate:'2026-02-01',version:1,operationId:randomUUID()},actor,true);
 const privatePast=await assignOrganization(f.pool,people[0].id,assignment(unit('recepcion').id,{responsibility:'Función histórica reservada'}),actor);await updateOrganizationAssignment(f.pool,people[0].id,privatePast.id,{endDate:'2026-02-01',version:1,operationId:randomUUID()},actor,true);
 const server=await testServer(f);t.after(()=>server.close());const client=httpClient(server.base),reader=await account(f,[]),base='/api/people/'+people[0].id+'/organization';assert.equal((await client.request(base)).status,401);
 for(const [permission,type,target]of [['personas.ver','person',people[0].id],['personas.editar','person',people[0].id]])await f.pool.query('INSERT INTO user_permissions(id,user_id,permission,scope_type,scope_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),reader.id,permission,type,target]);await client.login(reader);
 let data=await(await client.request(base)).json();assert.deepEqual(data.assignments,[]);assert.equal(data.events,null);assert.equal(data.history,null);assert.equal(data.canManage,false);assert.ok(!data.responsibilities.some(r=>r.name==='Función histórica reservada'));assert.ok(!(await(await client.request('/api/people/meta')).json()).organization.responsibilities.some(r=>r.name==='Función histórica reservada'));
 assert.equal((await client.request('/api/people/'+people[1].id+'/organization')).status,404);assert.equal((await client.request('/api/people/organization/units')).status,403);assert.equal((await client.request(base,{method:'POST',body:JSON.stringify(assignment(unit('recepcion').id))})).status,403);assert.equal((await(await client.request('/api/people?participation=ended')).json()).total,0);
 for(const permission of ['admin.usuarios.ver','admin.usuarios.gestionar','personas.historial'])await f.pool.query('INSERT INTO user_permissions(id,user_id,permission,scope_type,scope_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),reader.id,permission,permission==='personas.historial'?'person':'global',permission==='personas.historial'?people[0].id:null]);
 data=await(await client.request('/api/people/organization/units/'+unit('multimedia').id)).json();assert.equal(data.counts.members,0);assert.deepEqual(data.assignments,[]);assert.equal(data.limited,true);
 assert.equal((await client.request(base,{method:'POST',headers:{'X-CSRF-Token':''},body:JSON.stringify(assignment(unit('recepcion').id))})).status,403);assert.equal((await client.request(base,{method:'POST',body:JSON.stringify(assignment(unit('recepcion').id))})).status,201);
 const p=await principal(f.pool,reader.id);assert.ok(publicUser(p).access.paths.some(x=>x.path==='/oficina/areas'));assert.ok(!p.grants.some(g=>g.permission==='modulos.acceder'));
 assert.equal((await client.request(base+'/'+a.id+'/end',{method:'POST',body:JSON.stringify({endDate:'2026-03-01',version:1,operationId:randomUUID()})})).status,409);
});
test('Organización: runtime SQL restringido puede operar y no borrar el historial',async()=>{
 const f=await fixture(),role='erp_test_'+randomUUID().replaceAll('-','');let runtime;
 try{const user=await account(f),actor=await principal(f.pool,user.id),person=await f.people.save({...blankPerson(),names:'Prueba',lastNames:'Runtime'},{actorId:user.id});await f.pool.query(`CREATE ROLE ${role} NOLOGIN`);await grantRuntime(f.pool,role);runtime=new pg.Pool({connectionString:f.url,options:'-c role='+role});const unit=await saveOrganizationalUnit(runtime,null,area(),actor);await assignOrganization(runtime,person.id,assignment(unit.id),actor);assert.equal((await organizationalUnitDetail(runtime,unit.id,actor)).counts.members,1);await assert.rejects(()=>runtime.query('DELETE FROM organizational_assignments'),e=>e.code==='42501');await assert.rejects(()=>runtime.query('UPDATE organizational_events SET action=action'),e=>e.code==='42501');}
 finally{await runtime?.end();await f.pool.query(`DROP OWNED BY ${role}`);await f.pool.query(`DROP ROLE ${role}`);await f.close();}
});
