import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,account,httpClient,testServer} from './helpers.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {createUser} from '../server/identity/service.mjs';
import {createCellsService} from '../server/cells/service.mjs';
import {assignBatch,candidates} from '../server/cells/batch.mjs';
import {previewImportCells,resolveImportCell} from '../server/cells/import-preparation.mjs';
import {transaction} from '../server/db/pool.mjs';
import {migrate} from '../server/db/migrate.mjs';
import {blankPerson,sexes,validatePerson} from '../src/domain/person.js';
import {blankCell,cellCompletion} from '../src/domain/cell.js';
import {parseCellCode,normalizePersonSex,sexCellWarning,personImportSignals} from '../src/domain/import-normalization.js';
const all={all:true,ids:[]},date='2026-06-01';
async function setup(t){const f=await fixture();t.after(()=>f.close());const user=await account(f),ctx={user:await principal(f.pool,user.id)},s=createCellsService(f.pool);let n=0;
 return {f,user,ctx,s,person:(sex=null)=>f.people.save({...blankPerson(),names:'Rápida Demo',lastNames:'Persona',document:'DEMO-'+(++n),sex},{actorId:user.id,acknowledgeDuplicates:true}),cell:(groupCode='J')=>s.save({cell:{...blankCell(),groupCode}},ctx),batch:async(c,ids,extra={})=>assignBatch(f.pool,c.id,{personIds:ids,date,version:(await s.get(c.id)).version,...extra},ctx)};}
test('Persona: Hombre/Mujer, NULL permitido y normalización no adivina valores ambiguos',()=>{
 assert.deepEqual(sexes,{HOMBRE:'Hombre',MUJER:'Mujer'});
 for(const sex of ['HOMBRE','MUJER',null])assert.deepEqual(validatePerson({...blankPerson(),names:'Demo',lastNames:'Prueba',sex}).errors,{});
 for(const sex of ['OTRO','NO_INFORMA','MASCULINO','FEMENINO'])assert.ok(validatePerson({...blankPerson(),names:'Demo',lastNames:'Prueba',sex}).errors.sex);
 assert.equal(normalizePersonSex(' Masculino ').value,'HOMBRE');assert.equal(normalizePersonSex('femenino').value,'MUJER');assert.equal(normalizePersonSex('').value,null);assert.ok(normalizePersonSex('M').error);
 assert.equal(sexCellWarning('MUJER','F'),null);assert.ok(sexCellWarning('HOMBRE','F'));assert.equal(sexCellWarning(null,'F'),null);
 assert.deepEqual(personImportSignals({document:'demo-12.345',phone:'+00 123 456',names:'Ána',lastNames:'López'}),{document:'DEMO12345',phone:'00123456',name:'ana lopez'});
});
test('Migración 004 normaliza registros previos sin perder su valor original en auditoría',async t=>{
 const x=await setup(t),a=await x.person('HOMBRE'),b=await x.person('MUJER');
 await x.f.pool.query('ALTER TABLE people DROP CONSTRAINT people_sex_check');await x.f.pool.query('UPDATE people SET sex=$2 WHERE id=$1',[a.id,'MASCULINO']);await x.f.pool.query('UPDATE people SET sex=$2 WHERE id=$1',[b.id,'OTRO']);
 await x.f.pool.query("ALTER TABLE people ADD CONSTRAINT people_sex_check CHECK(sex IS NULL OR sex IN ('MASCULINO','FEMENINO','OTRO','NO_INFORMA'))");
 await x.f.pool.query("DELETE FROM schema_migrations WHERE name='004_office_workflow.sql'");await migrate(x.f.pool);
 assert.equal((await x.f.people.get(a.id)).sex,'HOMBRE');assert.equal((await x.f.people.get(b.id)).sex,null);
 const audit=(await x.f.pool.query("SELECT changes FROM audit_events WHERE action='PERSON_SEX_NORMALIZE' AND entity_id=$1",[b.id])).rows[0];assert.deepEqual(audit.changes,[{field:'sex',before:'OTRO',after:null}]);
});
test('Alta rápida usa Persona real, UUID, completitud, búsqueda e historial/auditoría existentes',async t=>{
 const x=await setup(t),s=await testServer(x.f);t.after(()=>s.close());const client=httpClient(s.base);await client.login(x.user);
 const response=await client.request('/api/people',{method:'POST',body:JSON.stringify({person:{names:'Ágil',lastNames:'Demo',sex:'MUJER',status:'ACTIVA'}})});assert.equal(response.status,201);const person=await response.json();assert.match(person.id,/^[\da-f-]{36}$/);assert.equal(person.completeness.percent,25);assert.equal((await x.f.people.list({q:'Agil'})).total,1);assert.equal((await x.f.people.history(person.id)).total,1);assert.equal((await x.f.pool.query("SELECT * FROM audit_events WHERE action='PERSON_CREATE' AND entity_id=$1",[person.id])).rowCount,1);
});
test('Batch: una confirmación, miembros predeterminados, advertencias y auditoría completa',async t=>{
 const x=await setup(t),c=await x.cell(),a=await x.person('HOMBRE'),b=await x.person('MUJER');const result=await x.batch(c,[a.id,b.id]);assert.equal(result.count,2);assert.equal(result.warnings.length,1);assert.equal(result.warnings[0].personId,a.id);
 assert.ok((await x.s.members(c.id,{},all)).items.every(m=>m.role==='MEMBER'));const audit=(await x.f.pool.query("SELECT * FROM audit_events WHERE action='CELL_BATCH_ASSIGN'")).rows[0];assert.equal(audit.changes.length,2);assert.equal(audit.actor_id,x.user.id);assert.equal(audit.context.count,2);
 const list=await candidates(x.f.pool,c.id,{},x.ctx);assert.ok(list.items.every(p=>p.state==='HERE'));
});
test('Batch: repetidos, otra célula y Persona inexistente rechazan el lote completo',async t=>{
 const x=await setup(t),a=await x.cell(),b=await x.cell('B'),p=await x.person(),q=await x.person();
 await assert.rejects(()=>x.batch(a,[p.id,p.id]),e=>e.status===422);await x.batch(b,[p.id]);await assert.rejects(()=>x.batch(a,[q.id,p.id]),e=>e.details.code==='BATCH_CONFLICT');assert.equal((await x.s.members(a.id,{},all)).total,0);
 await assert.rejects(()=>x.batch(a,[q.id,randomUUID()]),e=>e.status===404);assert.equal((await x.s.members(a.id,{},all)).total,0);
 const candidate=(await candidates(x.f.pool,a.id,{},x.ctx)).items.find(r=>r.id===p.id);assert.equal(candidate.state,'OTHER');assert.equal(candidate.current.displayCode,'B1 F');assert.equal(candidate.canTransfer,true);
 await x.s.move(b.id,{kind:'TRANSFER',personId:p.id,membershipId:candidate.current.membershipId,destinationId:a.id,role:'MEMBER',date,version:candidate.current.version},x.ctx);assert.equal((await x.s.personHistory(p.id,{},all)).current.cellId,a.id);
});
test('Batch: rollback de auditoría y concurrencia impiden resultados parciales',async t=>{
 const x=await setup(t),a=await x.cell(),b=await x.cell('B'),p=await x.person(),q=await x.person();const results=await Promise.allSettled([x.batch(a,[p.id,q.id]),x.batch(b,[q.id])]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await x.f.pool.query('SELECT * FROM cell_memberships WHERE "personId"=$1 AND "endDate" IS NULL',[q.id])).rowCount,1);
 const c=await x.cell('C'),fresh=await x.person();await x.f.pool.query("CREATE FUNCTION reject_batch_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test'; END $$; CREATE TRIGGER reject_batch_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_batch_audit();");
 await assert.rejects(()=>x.batch(c,[fresh.id]));assert.equal((await x.s.members(c.id,{},all)).total,0);assert.equal((await x.s.get(c.id)).version,1);
});
test('Batch y candidatos respetan permisos/alcances, CSRF y no revelan códigos restringidos',async t=>{
 const x=await setup(t),a=await x.cell(),b=await x.cell('B'),p=await x.person(),q=await x.person();await x.batch(b,[p.id]);
 const rid=randomUUID();await x.f.pool.query('INSERT INTO roles VALUES($1,$2)',[rid,'Operador limitado']);await x.f.pool.query("INSERT INTO role_permissions VALUES($1,'celulas.ver'),($1,'celulas.gestionar_integrantes'),($1,'personas.ver')",[rid]);const password=randomUUID()+randomUUID(),user=await createUser(x.f.pool,{username:'limited.'+randomUUID(),password,grants:[{roleId:rid,scopeType:'cell',scopeId:a.id},{roleId:rid,scopeType:'person',scopeId:p.id}]});const ctx={user:await principal(x.f.pool,user.id)};
 const data=await candidates(x.f.pool,a.id,{},ctx);assert.equal(data.total,1);assert.equal(data.items[0].state,'OTHER');assert.equal(data.items[0].current,null);assert.equal(data.items[0].canTransfer,false);await assert.rejects(()=>assignBatch(x.f.pool,a.id,{personIds:[q.id],date,version:1},ctx),e=>e.status===404);
 const s=await testServer(x.f);t.after(()=>s.close());const c=httpClient(s.base);assert.equal((await c.request('/api/cells/'+a.id+'/candidates')).status,401);await c.login(x.user);const post=body=>c.request('/api/cells/'+a.id+'/members/batch',{method:'POST',body:JSON.stringify(body)});
 assert.equal((await post({personIds:[q.id],date,version:1,role:'LEADER'})).status,422);assert.equal((await c.request('/api/cells/'+a.id+'/members/batch',{method:'POST',headers:{'X-CSRF-Token':''},body:JSON.stringify({personIds:[q.id],date,version:1})})).status,403);
});
test('Preparación CSV: normaliza, reutiliza solo activas y crea faltantes incompletas dentro de transacción',async t=>{
 const x=await setup(t),a=await x.cell();for(const input of ['j1f','J1F',' J1 F ','j 1 f'])assert.equal(parseCellCode(input).code,'J1 F');for(const input of ['J0F','J10000F','J1X','J01F','AB1F'])assert.ok(parseCellCode(input).error);
 const preview=await previewImportCells(x.f.pool,['j1f','J1 F','A2M','bad'],x.ctx);assert.equal(preview.existing,1);assert.equal(preview.toCreate,1);assert.equal(preview.errors.length,1);assert.equal((await x.s.list({},all)).total,1);
 const missing=await transaction(x.f.pool,db=>resolveImportCell(db,'a2m',x.ctx));assert.equal(missing.created,true);assert.equal(missing.cell.openedDate,null);assert.equal(missing.cell.lastEffectiveDate,null);assert.equal(cellCompletion(missing.cell).complete,false);
 const reused=await transaction(x.f.pool,db=>resolveImportCell(db,'A2 M',x.ctx));assert.equal(reused.created,false);assert.equal(reused.cell.id,missing.cell.id);
 await x.s.close(a.id,{mode:'CLOSE',date,version:a.version,allocations:[]},x.ctx);const newer=await transaction(x.f.pool,db=>resolveImportCell(db,'J1F',x.ctx));assert.notEqual(newer.cell.id,a.id);
 await assert.rejects(()=>transaction(x.f.pool,async db=>{await resolveImportCell(db,'R3F',x.ctx);throw new Error('simulated import failure');}));assert.equal((await x.s.list({q:'R3 F'},all)).total,0);
 const p=await x.person();await x.batch(missing.cell,[p.id]);const edited=await x.s.save({cell:{...blankCell(),groupCode:'A',generation:2,gender:'M',openedDate:'2026-01-01'},version:2},{...x.ctx,id:missing.cell.id});assert.equal(edited.openedDate,'2026-01-01');
});
test('Preparación CSV compone Persona + Célula + batch en una transacción externa sin escrituras parciales',async t=>{
 const x=await setup(t);const before=(await x.f.people.list()).total;
 await assert.rejects(()=>transaction(x.f.pool,async client=>{
  const p=await x.f.people.save({...blankPerson(),names:'Importación Demo',lastNames:'Prueba',sex:'MUJER'},{actorId:x.user.id,client});
  const result=await resolveImportCell(client,'Z2 F',x.ctx);
  await assignBatch(x.f.pool,result.cell.id,{personIds:[p.id],date,version:result.cell.version},{...x.ctx,client});
  throw new Error('failed whole import');
 }));
 assert.equal((await x.f.people.list()).total,before);assert.equal((await x.s.list({q:'Z2 F'},all)).total,0);assert.equal((await x.f.pool.query('SELECT * FROM cell_memberships')).rowCount,0);
});
