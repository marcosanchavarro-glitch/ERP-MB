import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,account,httpClient,testServer} from './helpers.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {saveTerritorialUnit} from '../server/territory/organization.mjs';
import {saveOuting,outingDetail,changeOutingState,saveOutingRoute} from '../server/territory/evangelism-service.mjs';
import {evangelismStatistics,listOutings} from '../server/territory/evangelism-query.mjs';
import {routeGeometry,validateOuting} from '../src/domain/evangelism.js';
import {blankPerson} from '../src/domain/person.js';
import {createUser} from '../server/identity/service.mjs';
import {publicUser} from '../server/identity/presentation.mjs';
const route={type:'LineString',coordinates:[[0,0],[1,0]]};
async function setup(t){const f=await fixture();t.after(()=>f.close());const user=await account(f),actor=await principal(f.pool,user.id);let unit=null;for(const [level,name]of [['COUNTRY','Argentina'],['PROVINCE','Buenos Aires'],['MUNICIPALITY','La Matanza'],['LOCALITY','Virrey del Pino'],['ZONE','Zona de prueba'],['SECTOR','Sector de prueba']])unit=await saveTerritorialUnit(f.pool,null,{level,name,parentId:unit?.id||null,geographyConfirmed:true},actor,'test-setup');const input={title:'Actividad de prueba',date:'2026-01-15',startTime:'09:00',endTime:'11:00',responsibleId:user.id,organizer:'Equipo de prueba',participantCount:null,unitId:unit.id,description:'Registro de prueba',notes:''};const create=extra=>saveOuting(f.pool,null,{outing:{...input,...extra}},actor,'test-create');return {f,user,actor,unit,input,create};}
test('Evangelismo: geometría GeoJSON acotada y longitud geométrica, nunca GPS ni propiedades arbitrarias',()=>{
 const r=routeGeometry(route);assert.ok(Math.abs(r.lengthMeters-111195.08)<.1);assert.deepEqual(r.geometry,route);
 for(const invalid of [null,{type:'Point',coordinates:[0,0]},{...route,properties:{personId:'private'}},{type:'LineString',coordinates:[[0,0]]},{type:'LineString',coordinates:[[0,0],[0,0]]},{type:'LineString',coordinates:[[0,0],[20,0]]},{type:'LineString',coordinates:[[0,0],[0,90]]},{type:'LineString',coordinates:[[0,0],[NaN,0]]},{type:'LineString',coordinates:[[0,0],[1,0,123]]},{type:'LineString',coordinates:Array.from({length:501},(_,i)=>[i/1000,0])}])assert.throws(()=>routeGeometry(invalid));
 assert.ok(validateOuting({}).errors.title);
});
test('Evangelismo: creación, edición, responsables, participantes, concurrencia, persistencia y auditoría',async t=>{
 const x=await setup(t),p=await x.f.people.save({...blankPerson(),names:'Persona',lastNames:'Participante'},{actorId:x.user.id});let a=await saveOuting(x.f.pool,null,{outing:{...x.input,participantCount:1},participantIds:[p.id]},x.actor,'create');let d=await outingDetail(x.f.pool,a.id,x.actor);assert.equal(d.status,'PLANNED');assert.equal(d.participants[0].id,p.id);assert.equal(d.route,null);assert.equal(d.participantCount,1);
 a=await saveOuting(x.f.pool,a.id,{outing:{...x.input,title:'Título corregido',participantCount:1},version:d.version},x.actor,'edit');d=await outingDetail(x.f.pool,a.id,x.actor);assert.equal(d.title,'Título corregido');assert.equal(d.participants.length,1);assert.equal(d.version,2);
 await assert.rejects(()=>saveOuting(x.f.pool,a.id,{outing:x.input,version:1},x.actor,'stale'),e=>e.status===409);
 await assert.rejects(()=>saveOuting(x.f.pool,a.id,{outing:{...x.input,participantCount:0},version:d.version,participantIds:[p.id]},x.actor,'bad'),e=>e.status===422);
 const audit=(await x.f.pool.query("SELECT * FROM audit_events WHERE entity='EVANGELISM_OUTING' ORDER BY sequence")).rows;assert.equal(audit.length,2);assert.ok(audit.every(e=>e.actor_id===x.user.id&&e.context.requestId));assert.ok(audit[1].changes.some(c=>c.field==='title'));
 await assert.rejects(()=>x.f.pool.query("DELETE FROM evangelism_events WHERE outing_id=$1",[a.id]),/append-only/);
 assert.equal((await x.f.pool.query('SELECT count(*)::int n FROM cell_memberships')).rows[0].n,0);
});
test('Evangelismo: transiciones válidas, cancelación razonada y fechas futuras sin actividad ficticia',async t=>{
 const x=await setup(t);let a=await x.create();await assert.rejects(()=>changeOutingState(x.f.pool,a.id,{status:'COMPLETED',confirmed:true,version:1},x.actor,'bad'),e=>e.status===409);
 await assert.rejects(()=>changeOutingState(x.f.pool,a.id,{status:'IN_PROGRESS',version:1},x.actor,'bad'),e=>e.status===422);
 a=await changeOutingState(x.f.pool,a.id,{status:'IN_PROGRESS',confirmed:true,version:1},x.actor,'start');a=await changeOutingState(x.f.pool,a.id,{status:'COMPLETED',confirmed:true,version:a.version},x.actor,'finish');assert.equal(a.status,'COMPLETED');
 await assert.rejects(()=>changeOutingState(x.f.pool,a.id,{status:'CANCELLED',confirmed:true,version:a.version,reason:'No corresponde'},x.actor,'bad'),e=>e.status===409);
 const b=await x.create({date:'2099-01-01'});await assert.rejects(()=>changeOutingState(x.f.pool,b.id,{status:'IN_PROGRESS',confirmed:true,version:1},x.actor,'future'),e=>e.status===422);
 await assert.rejects(()=>changeOutingState(x.f.pool,b.id,{status:'CANCELLED',confirmed:true,version:1,reason:55},x.actor,'bad'),e=>e.status===422);
 const c=await changeOutingState(x.f.pool,b.id,{status:'CANCELLED',confirmed:true,version:1,reason:'Actividad suspendida'},x.actor,'cancel');assert.equal(c.status,'CANCELLED');assert.equal((await outingDetail(x.f.pool,b.id,x.actor)).cancellationReason,'Actividad suspendida');
});
test('Evangelismo: recorrido manual explícito, versión, edición, privacidad y auditoría atómica',async t=>{
 const x=await setup(t),a=await x.create();await assert.rejects(()=>saveOutingRoute(x.f.pool,a.id,{geometry:route,version:1},x.actor,'bad'),e=>e.status===422);
 let saved=await saveOutingRoute(x.f.pool,a.id,{geometry:route,version:1,privacyConfirmed:true},x.actor,'route');assert.equal(saved.version,2);assert.equal(saved.source,'MANUAL');assert.deepEqual((await outingDetail(x.f.pool,a.id,x.actor)).route.geometry,route);
 await assert.rejects(()=>saveOutingRoute(x.f.pool,a.id,{geometry:route,version:1,privacyConfirmed:true},x.actor,'stale'),e=>e.status===409);
 saved=await saveOutingRoute(x.f.pool,a.id,{geometry:{type:'LineString',coordinates:[[0,0],[.5,0]]},version:2,privacyConfirmed:true},x.actor,'route-edit');assert.equal(saved.version,3);
 const audit=(await x.f.pool.query("SELECT changes FROM audit_events WHERE action='EVANGELISM_ROUTE_UPDATE' ORDER BY sequence")).rows;assert.equal(audit.length,2);assert.deepEqual(audit[1].changes[0].before.geometry,route);
 await x.f.pool.query("ALTER TABLE audit_events ADD CONSTRAINT test_fail_evangelism CHECK(action<>'EVANGELISM_ROUTE_UPDATE') NOT VALID");
 await assert.rejects(()=>saveOutingRoute(x.f.pool,a.id,{geometry:route,version:3,privacyConfirmed:true},x.actor,'rollback'));assert.equal((await outingDetail(x.f.pool,a.id,x.actor)).version,3);
});
test('Evangelismo: filtros/paginación, estadísticas reales, comparación, sectores y participaciones no únicas',async t=>{
 const x=await setup(t);for(const [date,count]of [['2026-01-10',5],['2026-01-15',7],['2025-12-10',3]]){let a=await x.create({date,participantCount:count});a=await changeOutingState(x.f.pool,a.id,{status:'IN_PROGRESS',confirmed:true,version:a.version},x.actor,'start');await changeOutingState(x.f.pool,a.id,{status:'COMPLETED',confirmed:true,version:a.version},x.actor,'finish');}
 const planned=await x.create({date:'2026-01-20'}),cancelled=await x.create({date:'2026-01-21'});await changeOutingState(x.f.pool,cancelled.id,{status:'CANCELLED',confirmed:true,version:1,reason:'Suspendida'},x.actor,'cancel');
 const q={from:'2026-01-01',to:'2026-01-31',compareFrom:'2025-12-01',compareTo:'2025-12-31'};let stats=await evangelismStatistics(x.f.pool,q,x.actor);assert.equal(stats.totals.current.completed,2);assert.equal(stats.totals.current.planned,1);assert.equal(stats.totals.current.cancelled,1);assert.equal(stats.totals.current.participations,12);assert.equal(stats.totals.previous.completed,1);assert.equal(stats.totals.previous.participations,3);assert.equal(stats.visited_sectors,1);assert.equal(stats.sectors[0].visits,2);assert.equal(stats.monthly[0].activities,4);
 assert.equal((await listOutings(x.f.pool,{from:q.from,to:q.to,status:'PLANNED',sector:x.unit.id},x.actor)).items[0].id,planned.id);
 stats=await evangelismStatistics(x.f.pool,{from:'2024-01-01',to:'2024-01-31'},x.actor);assert.equal(stats.totals.current.activities,0);assert.equal(stats.sectors_without_visits,1);assert.deepEqual(stats.monthly,[]);
 await assert.rejects(()=>listOutings(x.f.pool,{from:'2020-01-01',to:'2026-01-01'},x.actor),e=>e.status===422);
});
test('Evangelismo: permisos diferenciados, CSRF, datos personales mínimos y acceso efectivo',async t=>{
 const x=await setup(t),a=await x.create(),server=await testServer(x.f);t.after(()=>server.close());const client=httpClient(server.base);assert.equal((await client.request('/api/territory/evangelism/meta')).status,401);
 const password=randomUUID()+randomUUID(),u=await createUser(x.f.pool,{username:'evangelism.'+randomUUID(),password,grants:[]});for(const [p,type,id]of [['evangelismo.ver','global',null],['modulos.acceder','subarea','territorio-evangelismo']])await x.f.pool.query('INSERT INTO user_permissions(id,user_id,permission,scope_type,scope_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),u.id,p,type,id]);
 await client.login({...u,password});let response=await client.request('/api/territory/evangelism/meta');assert.equal(response.status,200);const meta=await response.json();assert.deepEqual(meta.mapBase.items,[]);assert.equal(meta.capabilities.crear,false);assert.equal(meta.canLinkParticipants,false);assert.equal(meta.responsibles.length,1);
 assert.equal((await client.request('/api/territory/evangelism/outings/'+a.id)).status,200);assert.equal((await client.request('/api/territory/evangelism/outings',{method:'POST',body:JSON.stringify({outing:x.input})})).status,403);assert.equal((await client.request('/api/territory/evangelism/statistics')).status,403);assert.equal((await client.request('/api/territory/evangelism/outings/'+a.id+'/route',{method:'PUT',body:JSON.stringify({geometry:route,version:1,privacyConfirmed:true})})).status,403);assert.equal((await client.request('/api/territory/evangelism/people?q=Persona')).status,403);
 assert.ok(publicUser(await principal(x.f.pool,u.id)).access.paths.some(p=>p.path==='/territorio/evangelismo'));
 await x.f.pool.query("DELETE FROM user_permissions WHERE user_id=$1 AND permission='evangelismo.ver'",[u.id]);assert.equal((await client.request('/api/territory/evangelism/outings/'+a.id)).status,403);assert.ok(!publicUser(await principal(x.f.pool,u.id)).access.paths.some(p=>p.path==='/territorio/evangelismo'));
 await x.f.pool.query("INSERT INTO user_permissions(id,user_id,permission,scope_type) VALUES($1,$2,'evangelismo.estadisticas','global')",[randomUUID(),u.id]);
 const statsMeta=await (await client.request('/api/territory/evangelism/meta')).json();assert.equal(statsMeta.capabilities.ver,false);assert.equal(statsMeta.capabilities.estadisticas,true);assert.equal(statsMeta.mapBase,null);
 const statsResponse=await client.request('/api/territory/evangelism/statistics?from=2026-01-01&to=2026-01-31');assert.equal(statsResponse.status,200);const stats=await statsResponse.json();assert.ok(!JSON.stringify(stats).includes('geometry'));assert.ok(!JSON.stringify(stats).includes('person_id'));assert.equal((await client.request('/api/territory/evangelism/routes?from=2026-01-01&to=2026-01-31')).status,403);
 const admin=httpClient(server.base);await admin.login(x.user);assert.equal((await admin.request('/api/territory/evangelism/outings',{method:'POST',headers:{'X-CSRF-Token':''},body:JSON.stringify({outing:x.input})})).status,403);
});
