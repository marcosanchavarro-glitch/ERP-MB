import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,account,httpClient,testServer} from './helpers.mjs';
import {createCellsService} from '../server/cells/service.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {createUser} from '../server/identity/service.mjs';
import {leaderCellIds} from '../server/cells/leader-access.mjs';
import {blankPerson} from '../src/domain/person.js';
import {blankCell} from '../src/domain/cell.js';
const date='2026-01-01',all={all:true,ids:[]};
async function setup(t){const f=await fixture();t.after(()=>f.close());const user=await account(f),s=createCellsService(f.pool),ctx={user:await principal(f.pool,user.id)};let count=0;
 const person=()=>f.people.save({...blankPerson(),names:'Persona Demo',lastNames:'Celular',document:'TEST-'+(++count)},{actorId:user.id,acknowledgeDuplicates:true});
 const cell=(groupCode='J',generation=1)=>s.save({cell:{...blankCell(),groupCode,generation,openedDate:date}},ctx);
 const move=async(c,p,kind='ASSIGN',extra={})=>s.move(c.id,{kind,personId:p.id,role:'MEMBER',date,version:(await s.get(c.id)).version,...extra},ctx);
 const close=async(c,extra={})=>s.close(c.id,{mode:'CLOSE',date,version:(await s.get(c.id)).version,allocations:[],...extra},ctx);
 return {f,user,s,ctx,person,cell,move,close};}
test('Células: código estructurado, unicidad activa, cierre y reutilización con otro UUID',async t=>{
 const x=await setup(t),a=await x.cell();assert.equal(a.displayCode,'J1 F');assert.equal(a.generation,1);
 await assert.rejects(()=>x.cell(),e=>e.status===409);await x.close(a);const b=await x.cell();assert.notEqual(a.id,b.id);assert.equal((await x.s.get(a.id)).status,'CLOSED');
 await assert.rejects(()=>x.s.save({cell:{...blankCell(),groupCode:'XX'}},x.ctx),e=>e.status===422);
 await assert.rejects(()=>x.s.save({cell:{...blankCell(),id:randomUUID()}},x.ctx),e=>e.status===422);
 assert.equal((await x.s.list({status:'ACTIVE',q:'J1'},all)).total,1);assert.equal((await x.s.list({status:'CLOSED'},all)).total,1);
});
test('Cupos: máximo dos líderes, tres asistentes y una célula vigente por Persona',async t=>{
 const x=await setup(t),a=await x.cell(),b=await x.cell('B');
 for(let i=0;i<2;i++)await x.move(a,await x.person(),'ASSIGN',{role:'LEADER'});
 await assert.rejects(()=>x.person().then(p=>x.move(a,p,'ASSIGN',{role:'LEADER'})),e=>e.status===409);
 for(let i=0;i<3;i++)await x.move(a,await x.person(),'ASSIGN',{role:'ASSISTANT'});
 await assert.rejects(()=>x.person().then(p=>x.move(a,p,'ASSIGN',{role:'ASSISTANT'})),e=>e.status===409);
 const p=await x.person();await x.f.pool.query('UPDATE people SET sex=$2 WHERE id=$1',[p.id,'HOMBRE']);await x.move(a,p);await assert.rejects(()=>x.move(b,p),e=>e.status===409);
 const m=(await x.s.personHistory(p.id,{},all)).current;await assert.rejects(()=>x.f.pool.query('UPDATE cell_memberships SET role=\'LEADER\' WHERE id=$1',[m.id]));
 assert.equal((await x.s.members(a.id,{},all)).total,6);
});
test('Jerarquías, cambio de liderazgo, transferencia y finalización preservan períodos e historia',async t=>{
 const x=await setup(t),a=await x.cell(),b=await x.cell('B'),p=await x.person();await x.move(a,p);
 let m=(await x.s.personHistory(p.id,{},all)).current;
 await x.move(a,p,'ROLE',{membershipId:m.id,role:'ASSISTANT',date:'2026-02-01'});m=(await x.s.personHistory(p.id,{},all)).current;
 await x.move(a,p,'ROLE',{membershipId:m.id,role:'LEADER',date:'2026-03-01'});m=(await x.s.personHistory(p.id,{},all)).current;
 await x.f.pool.query('UPDATE users SET person_id=$1 WHERE id=$2',[p.id,x.user.id]);assert.deepEqual(await leaderCellIds(x.f.pool,x.user.id),[a.id]);
 await x.move(a,p,'TRANSFER',{membershipId:m.id,destinationId:b.id,role:'MEMBER',date:'2026-04-01'});
 const h=await x.s.personHistory(p.id,{},all);assert.equal(h.total,4);assert.equal(h.current.cellId,b.id);assert.equal(h.items.filter(m=>!m.endDate).length,1);assert.ok(h.items.some(m=>m.role==='ASSISTANT'&&m.endDate==='2026-03-01'));
 assert.equal((await x.s.history(b.id,{},all)).total,2);assert.deepEqual(await leaderCellIds(x.f.pool,x.user.id),[]);
 await x.move(b,p,'END',{membershipId:h.current.id,date:'2026-05-01'});assert.equal((await x.s.personHistory(p.id,{},all)).current,null);
 await assert.rejects(()=>x.move(a,p,'ASSIGN',{date:'2026-04-30'}),e=>e.status===422);
 const audits=(await x.f.pool.query("SELECT * FROM audit_events WHERE action='CELL_TRANSFER'")).rows;assert.equal(audits.length,1);assert.equal(audits[0].changes[0].before.cellId,a.id);assert.equal(audits[0].changes[0].after.cellId,b.id);
});
test('Absorción transaccional: conserva origen, destino, integrantes y código liberado',async t=>{
 const x=await setup(t),a=await x.cell(),b=await x.cell('B');for(let i=0;i<3;i++)await x.move(a,await x.person());
 const old=(await x.s.members(a.id,{},all)).items;await x.close(a,{mode:'ABSORB',destinationId:b.id,allocations:old.map(m=>({membershipId:m.id,destinationId:b.id,role:'MEMBER'}))});
 assert.equal((await x.s.members(a.id,{},all)).total,0);assert.equal((await x.s.members(b.id,{},all)).total,3);assert.equal((await x.s.get(b.id)).status,'ACTIVE');
 const op=(await x.f.pool.query("SELECT * FROM cell_operations WHERE kind='ABSORB'")).rows[0];assert.equal(op.sourceCellId,a.id);assert.equal(op.destinationCellId,b.id);assert.notEqual((await x.cell()).id,a.id);
});
test('Redistribución valida cobertura completa, destinos, cupos y cierre total conserva Personas',async t=>{
 const x=await setup(t),a=await x.cell(),b=await x.cell('B'),c=await x.cell('C');for(let i=0;i<3;i++)await x.move(a,await x.person());const old=(await x.s.members(a.id,{},all)).items;
 await assert.rejects(()=>x.close(a,{mode:'REDISTRIBUTE',allocations:[]}),e=>e.status===409);
 await assert.rejects(()=>x.close(a,{mode:'ABSORB',destinationId:b.id,allocations:old.map(m=>({membershipId:m.id,destinationId:b.id,role:'LEADER'}))}),e=>e.status===409);
 assert.equal((await x.s.members(a.id,{},all)).total,3);
 await x.close(a,{mode:'REDISTRIBUTE',allocations:old.map((m,i)=>({membershipId:m.id,destinationId:i===2?c.id:b.id,role:'MEMBER'}))});
 assert.equal((await x.s.members(b.id,{},all)).total,2);assert.equal((await x.s.members(c.id,{},all)).total,1);await x.close(b);assert.equal((await x.s.members(b.id,{},all)).total,0);assert.equal((await x.f.people.list()).total,3);
});
test('Rollback: una falla de auditoría revierte transferencia y cierre con todas sus relaciones',async t=>{
 const x=await setup(t),a=await x.cell(),b=await x.cell('B'),p=await x.person();await x.move(a,p);const old=(await x.s.personHistory(p.id,{},all)).current;
 await x.f.pool.query("CREATE FUNCTION reject_cell_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$; CREATE TRIGGER reject_cell_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_cell_audit();");
 await assert.rejects(()=>x.move(a,p,'TRANSFER',{membershipId:old.id,destinationId:b.id}));await assert.rejects(()=>x.close(a));
 assert.equal((await x.s.get(a.id)).status,'ACTIVE');assert.equal((await x.s.personHistory(p.id,{},all)).current.id,old.id);assert.equal((await x.s.personHistory(p.id,{},all)).total,1);assert.equal((await x.s.members(b.id,{},all)).total,0);
 assert.equal(Number((await x.f.pool.query("SELECT count(*) AS n FROM cell_operations WHERE kind IN ('TRANSFER','CLOSE')")).rows[0].n),0);
});
test('Concurrencia: doble asignación, cupos, edición obsoleta y cierre con versión antigua',async t=>{
 const x=await setup(t),a=await x.cell(),b=await x.cell('B'),p=await x.person();let results=await Promise.allSettled([x.move(a,p),x.move(b,p)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const c=await x.cell('C');await x.move(c,await x.person(),'ASSIGN',{role:'LEADER'});const people=await Promise.all([x.person(),x.person()]);results=await Promise.allSettled(people.map(p=>x.move(c,p,'ASSIGN',{role:'LEADER'})));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await x.s.members(c.id,{},all)).items.filter(m=>m.role==='LEADER').length,2);
 await assert.rejects(()=>x.s.close(c.id,{mode:'CLOSE',date,version:1,allocations:[]},x.ctx),e=>e.status===409);
 await assert.rejects(()=>x.s.save({cell:{...blankCell(),groupCode:'C',openedDate:date},version:1},{...x.ctx,id:c.id}),e=>e.status===409);
});
test('API Células: sesiones, permisos por célula, IDOR, CSRF, payload y Ficha 360°',async t=>{
 const x=await setup(t),server=await testServer(x.f);t.after(()=>server.close());const c=httpClient(server.base),a=await x.cell(),b=await x.cell('B'),p=await x.person();await x.move(a,p);
 assert.equal((await c.request('/api/cells')).status,401);await c.login(x.user);
 assert.equal((await c.request('/api/cells/'+a.id)).status,200);assert.equal((await (await c.request('/api/cells/person/'+p.id)).json()).current.cellId,a.id);
 assert.equal((await c.request('/api/cells',{method:'POST',headers:{'X-CSRF-Token':''},body:JSON.stringify({cell:{...blankCell(),groupCode:'Q'}})})).status,403);
 assert.equal((await c.request('/api/cells/'+a.id,{method:'PUT',body:JSON.stringify({cell:{...blankCell(),status:'CLOSED'},version:2})})).status,422);
 assert.equal((await (await c.request('/api/cells?q='+encodeURIComponent("' OR 1=1 --"))).json()).total,0);
 const roleId=randomUUID();await x.f.pool.query('INSERT INTO roles VALUES($1,$2)',[roleId,'Célula limitada']);await x.f.pool.query("INSERT INTO role_permissions VALUES($1,'celulas.ver'),($1,'celulas.transferir')",[roleId]);const password=randomUUID()+randomUUID(),user=await createUser(x.f.pool,{username:'scoped.'+randomUUID(),password,grants:[{roleId,scopeType:'cell',scopeId:a.id}]});const scoped=httpClient(server.base);await scoped.login({...user,password});
 assert.equal((await (await scoped.request('/api/cells')).json()).total,1);assert.equal((await scoped.request('/api/cells/'+b.id)).status,404);assert.equal((await scoped.request('/api/cells/'+b.id+'/history')).status,404);assert.equal((await scoped.request('/api/cells/person/'+p.id)).status,403);
 assert.equal((await (await scoped.request('/api/cells/'+a.id+'/members')).json()).items[0].person,null);
 assert.equal((await scoped.request('/api/cells/'+a.id+'/close',{method:'POST',body:JSON.stringify({mode:'CLOSE',date,allocations:[],version:2})})).status,403);
 assert.equal((await c.request('/api/cells/'+a.id,{method:'DELETE'})).status,405);
 await x.f.pool.query("INSERT INTO role_permissions VALUES($1,'personas.ver')",[roleId]);
 await x.f.pool.query("INSERT INTO user_roles(id,user_id,role_id,scope_type,scope_id) VALUES($1,$2,$3,'person',$4)",[randomUUID(),user.id,roleId,p.id]);
 const membership=(await x.s.personHistory(p.id,{},all)).current;
 assert.equal((await scoped.request('/api/cells/'+a.id+'/movements',{method:'POST',body:JSON.stringify({kind:'TRANSFER',personId:p.id,membershipId:membership.id,destinationId:b.id,role:'MEMBER',date,version:2})})).status,404);
 assert.equal((await (await scoped.request('/api/cells/person/'+p.id)).json()).total,1);

 await x.f.pool.query('DELETE FROM user_roles WHERE user_id=$1',[user.id]);assert.equal((await scoped.request('/api/cells')).status,403);
});
test('Restricciones PostgreSQL impiden duplicados y exceso de líderes incluso con INSERT directo concurrente',async t=>{
 const x=await setup(t),a=await x.cell(),p=await x.person();await x.move(a,p,'ASSIGN',{role:'LEADER'});const current=(await x.s.personHistory(p.id,{},all)).current,others=await Promise.all([x.person(),x.person()]);
 const insert=personId=>x.f.pool.query('INSERT INTO cell_memberships(id,"cellId","personId",role,"startDate","startOperationId") VALUES($1,$2,$3,\'LEADER\',$4,$5)',[randomUUID(),a.id,personId,date,current.startOperationId]);
 const result=await Promise.allSettled(others.map(p=>insert(p.id)));assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal((await x.s.members(a.id,{},all)).total,2);
 await assert.rejects(()=>insert(p.id));await assert.rejects(()=>x.f.pool.query('UPDATE cells SET status=\'CLOSED\',"closedDate"=$2 WHERE id=$1',[a.id,date]));await assert.rejects(()=>x.f.pool.query('DELETE FROM cell_memberships'));await assert.rejects(()=>x.f.pool.query('DELETE FROM cells'));
});
test('Fechas y destinos cerrados: no se programan cambios futuros ni se reescriben períodos',async t=>{
 const x=await setup(t),a=await x.cell(),b=await x.cell('B'),p=await x.person();await x.move(a,p,'ASSIGN',{date:'2026-02-01'});const m=(await x.s.personHistory(p.id,{},all)).current;
 await assert.rejects(()=>x.move(a,p,'ROLE',{membershipId:m.id,role:'LEADER',date:'2026-01-31'}),e=>e.status===422);
 await assert.rejects(()=>x.move(a,p,'ROLE',{membershipId:m.id,role:'LEADER',date:'2999-01-01'}),e=>e.status===422);
 await x.close(b);await assert.rejects(()=>x.move(a,p,'TRANSFER',{membershipId:m.id,destinationId:b.id,date:'2026-02-01'}),e=>e.status===409);
 await assert.rejects(()=>x.close(b),e=>e.status===409);
});
test('Listados de Células: filtros, orden numérico y paginación SQL sobre 5000 células sin N+1',async t=>{
 const x=await setup(t);
 await x.f.pool.query(`INSERT INTO cells(id,"groupCode",generation,gender,"openedDate","lastEffectiveDate","meetingDay",locality) SELECT gen_random_uuid(),'Q',n,CASE WHEN n%2=0 THEN 'F' ELSE 'M' END,'2026-01-01','2026-01-01','2','Zona Demo' FROM generate_series(1,5000) n`);
 let queries=0;const query=x.f.pool.query.bind(x.f.pool);x.f.pool.query=(...args)=>{queries++;return query(...args);};const start=performance.now();const result=await x.s.list({groupCode:'Q',gender:'F',meetingDay:'2',locality:'zona demo',page:100,pageSize:20,sort:'code'},all);const elapsed=performance.now()-start;x.f.pool.query=query;
 assert.equal(result.total,2500);assert.equal(result.items.length,20);assert.equal(result.page,100);assert.equal(queries,3);assert.equal(result.items[0].displayCode,'Q3962 F');assert.equal((await x.s.list({q:'%'},all)).total,0);
 t.diagnostic('Listado/página 100 sobre 5000 células: '+elapsed.toFixed(1)+' ms, 3 consultas (no es SLA).');
});
