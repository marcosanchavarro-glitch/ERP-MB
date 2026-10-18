import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,account,testServer,httpClient} from './helpers.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {createOfficeService} from '../server/office/service.mjs';
import {personQuality,cellQuality} from '../server/office/quality.mjs';
import {birthdayInfo,birthdayRange,birthdayInRange} from '../src/domain/birthday.js';
import {calendarToday} from '../src/domain/calendar.js';
import {blankPerson,completeness,fields} from '../src/domain/person.js';
import {blankCell,today} from '../src/domain/cell.js';
import {createCellsService} from '../server/cells/service.mjs';
import {readConfig} from '../server/core/config.mjs';
import {publicUser} from '../server/identity/presentation.mjs';
const now=()=>new Date('2026-12-31T15:00:00Z');
test('1.6 cumpleaños: edad, año siguiente, 29/02 y fechas inválidas',()=>{
 assert.equal(birthdayInfo('2000-01-01','2026-12-31').age,26);assert.equal(birthdayInfo('2000-01-01','2026-12-31').turning,27);assert.equal(birthdayInfo('2000-01-01','2026-12-31').days,1);
 assert.equal(birthdayInfo('2000-10-17','2026-10-16').age,25);assert.equal(birthdayInfo('2000-10-17','2026-10-17').age,26);assert.equal(birthdayInfo('2000-10-17','2026-10-18').turning,27);
 assert.equal(birthdayInfo('2000-02-29','2027-02-28').age,27);assert.equal(birthdayInfo('2000-02-29','2027-02-28').days,0);assert.equal(birthdayInfo('2000-02-29','2028-02-28').age,27);assert.equal(birthdayInfo('2000-02-29','2028-02-28').days,1);
 for(const value of [null,'2026-02-30','3000-01-01','invalid'])assert.equal(birthdayInfo(value,'2026-12-31'),null);
});
test('1.6 períodos: hoy/mañana/semana/7 días/mes/próximo mes, cruce diciembre-enero y timezone',()=>{
 const ref='2026-12-31',match=(birth,view)=>birthdayInRange(birth,birthdayRange(view,ref));
 assert.ok(match('1990-12-31','today'));assert.ok(!match('1990-01-01','today'));assert.ok(match('1990-01-01','tomorrow'));
 assert.ok(match('1990-12-28','week'));assert.ok(match('1990-01-03','week'));assert.ok(!match('1990-01-04','week'));
 assert.ok(match('1990-01-06','next7'));assert.ok(!match('1990-01-07','next7'));
 assert.ok(match('1990-12-01','month'));assert.ok(!match('1990-01-01','month'));assert.ok(match('1990-01-31','nextMonth'));assert.ok(!match('1990-02-01','nextMonth'));assert.ok(match('1990-05-04','all'));
 assert.ok(birthdayInRange('2000-02-29',birthdayRange('today','2027-02-28')));
 const instant=new Date('2026-01-01T01:30:00Z');assert.equal(calendarToday('America/Argentina/Buenos_Aires',instant),'2025-12-31');assert.equal(calendarToday('Asia/Tokyo',instant),'2026-01-01');
});
test('1.6 calidad: política única, opcionales, requeridos, recomendados e inconsistencias extensibles',()=>{
 const p={...blankPerson(),names:'Ana',lastNames:'Pérez',document:'12345',birthDate:'2000-01-01',phone:'11123456',email:'a@example.test',address:'Calle',locality:'Ciudad',sex:'MUJER',cells:[],membershipCount:0};
 let q=personQuality(p,'2026-12-31');assert.deepEqual(q.completeness,completeness(p));assert.equal(q.level,'complete');assert.equal(q.problems.length,0);
 q=personQuality({...p,names:'',sex:null,phone:null,duplicate_name:2,duplicate_phone:2,membershipCount:2,cells:[{gender:'M'}]},'2026-12-31');assert.ok(q.problems.some(x=>x.code==='missing_names'&&x.severity==='error'));assert.ok(q.problems.some(x=>x.code==='missing_phone'&&x.severity==='recommended'));assert.ok(q.problems.some(x=>x.code==='missing_sex'));assert.ok(q.problems.some(x=>x.code==='memberships'));assert.equal(q.completeness.percent,75);
 assert.ok(personQuality({...p,cells:[{gender:'M'}]},'2026-12-31').problems.some(x=>x.code==='sex_cell'));
 assert.ok(personQuality({...p,birthDate:'2026-02-30'},'2026-12-31').problems.some(x=>x.code==='invalid'));
 assert.ok(personQuality({...p,duplicate_document:2},'2026-12-31').problems.some(x=>x.code==='duplicate_document'));
 assert.ok(personQuality({...p,status:'INACTIVA',activeUser:true},'2026-12-31').problems.some(x=>x.code==='active_user'));
 assert.deepEqual(cellQuality({leaders:0}).problems.map(p=>p.code),['missing_openedDate','missing_meetingDay','missing_meetingTime','missing_address','missing_locality','missing_leader']);
});
async function setup(t){const f=await fixture();t.after(()=>f.close());const admin=await account(f),user=await principal(f.pool,admin.id),service=createOfficeService(f.pool,{now}),person=overrides=>f.people.save({...blankPerson(),names:'Ana',lastNames:'Prueba',...overrides},{actorId:admin.id,acknowledgeDuplicates:true});return {f,admin,user,service,person};}
test('1.6 backend: orden cumpleaños, filtros, paginación y DTO mínimo',async t=>{
 const x=await setup(t);await x.person({names:'Zoe',birthDate:'1990-12-31',sex:'MUJER',notes:'PRIVATE',document:'PRIVATE-123',email:'private@example.test'});await x.person({names:'Ana',birthDate:'1980-01-01',sex:'HOMBRE'});await x.person({names:'Inactiva',status:'INACTIVA',birthDate:'1990-12-31'});
 let result=await x.service.birthdays({view:'all'},x.user);assert.deepEqual(result.items.map(p=>p.names),['Zoe','Ana']);assert.equal(result.items[0].birthday.days,0);assert.ok(!JSON.stringify(result).includes('PRIVATE'));assert.ok(!JSON.stringify(result).includes('private@example'));
 assert.equal((await x.service.birthdays({view:'tomorrow'},x.user)).items[0].names,'Ana');assert.equal((await x.service.birthdays({view:'all',minAge:'40',sex:'HOMBRE',month:'1'},x.user)).total,1);assert.equal((await x.service.birthdays({view:'all',status:'INACTIVA'},x.user)).total,1);
 for(let i=0;i<23;i++)await x.person({birthDate:'1990-01-02'});
 result=await x.service.birthdays({view:'all',page:'2'},x.user);assert.equal(result.total,25);assert.equal(result.items.length,5);assert.equal(result.pages,2);
 await assert.rejects(()=>x.service.birthdays({minAge:'9',maxAge:'2'},x.user),e=>e.status===422);await assert.rejects(()=>x.service.people({cellId:'bad'},x.user),e=>e.status===422);
 assert.equal((await x.service.birthdays({view:'all',q:"' OR 1=1 --"},x.user)).total,0);
});
test('1.6 calidad: filtros, células, coincidencias, corrección auditada y métricas reales',async t=>{
 const x=await setup(t),a=await x.person({phone:'11 1234 5678',sex:'HOMBRE'});await x.person({phone:'1112345678'});
 const cells=createCellsService(x.f.pool),cell=await cells.save({cell:{...blankCell(),groupCode:'Q',openedDate:today()}},{user:x.user});
 await cells.move(cell.id,{kind:'ASSIGN',personId:a.id,role:'MEMBER',date:today(),version:cell.version},{user:x.user});
 let result=await x.service.people({},x.user);assert.equal(result.summary.total,2);assert.equal(result.summary.average,38);assert.equal(result.summary.duplicates,2);assert.ok(result.items.find(p=>p.id===a.id).problems.some(p=>p.code==='sex_cell'));assert.equal((await x.service.people({problem:'duplicate_phone'},x.user)).total,2);assert.equal((await x.service.people({cellId:cell.id},x.user)).total,1);
 assert.ok((await x.service.cells({},x.user)).items[0].problems.some(p=>p.code==='missing_leader'));
 const old=await x.f.people.get(a.id),input=Object.fromEntries(fields.map(f=>[f.key,old[f.key]]));await x.f.people.save({...input,birthDate:'2000-01-01'},{id:a.id,version:old.version,actorId:x.admin.id,acknowledgeDuplicates:true});
 result=await x.service.people({problem:'missing_birthDate'},x.user);assert.equal(result.total,1);assert.equal(result.summary.problems.missing_birthDate,1);assert.equal(result.summary.average,44);assert.ok((await x.f.people.history(a.id)).items.length>1);
});
test('1.6 permisos: denegación líder/áreas, intersección de scopes, privacidad de duplicados y endpoints HTTP',async t=>{
 const x=await setup(t),a=await x.person({phone:'1112345678',birthDate:'2000-01-01'}),b=await x.person({phone:'1112345678',birthDate:'2000-01-01'});
 const restricted={id:x.admin.id,grants:[{permission:'personas.ver',scope_type:'person',scope_id:a.id},{permission:'personas.calidad',scope_type:'global'},{permission:'personas.cumpleanos',scope_type:'global'}]};
 let result=await x.service.people({},restricted);assert.equal(result.total,1);assert.equal(result.summary.duplicates,0);assert.ok(!JSON.stringify(result).includes(b.id));assert.equal((await x.service.birthdays({view:'all'},restricted)).total,1);
 await assert.rejects(()=>x.service.people({}, {grants:[{permission:'lider.portal',scope_type:'global'}]}),e=>e.status===403);await assert.rejects(()=>x.service.cells({},restricted),e=>e.status===403);
 const s=await testServer(x.f),api=httpClient(s.base);assert.equal((await api.request('/api/office/quality/people')).status,401);await api.login(await account(x.f,[]));assert.equal((await api.request('/api/office/birthdays')).status,403);await api.login(x.admin);assert.equal((await api.request('/api/office/quality/people')).status,200);assert.equal((await api.request('/api/office/quality/people?secret=1')).status,422);assert.equal((await api.request('/api/office/quality/people?page=2')).status,200);
 const cellUser={grants:[{permission:'celulas.calidad',scope_type:'cell',scope_id:a.id},{permission:'celulas.ver',scope_type:'cell',scope_id:a.id}]};assert.equal((await x.service.cells({},cellUser)).total,0);
});
test('1.6 calidad: paginación, inactivos, filtros combinados y detección sin mutaciones/auditoría',async t=>{
 const x=await setup(t);for(let i=0;i<24;i++)await x.person({names:'Persona '+String.fromCharCode(65+i),status:i===23?'INACTIVA':'ACTIVA'});
 const before=(await x.f.pool.query('SELECT count(*)::int n FROM audit_events')).rows[0].n;
 const first=await x.service.people({},x.user),second=await x.service.people({page:'2',problem:'missing_sex'},x.user);
 assert.equal(first.items.length,20);assert.equal(first.total,23);assert.equal(second.items.length,3);assert.equal(second.summary.problems.missing_sex,23);assert.ok(!second.items.some(p=>first.items.some(a=>a.id===p.id)));
 assert.equal((await x.service.people({status:'INACTIVA'},x.user)).items[0].priority,'historical');assert.equal((await x.service.people({completeness:'complete'},x.user)).total,0);assert.equal((await x.service.people({q:'Persona A',completeness:'incomplete',problem:'missing_phone'},x.user)).total,1);
 assert.equal((await x.f.pool.query('SELECT count(*)::int n FROM audit_events')).rows[0].n,before);
});
test('1.6 perfiles Oficina/Apóstol/Admin reciben permisos, áreas y líder no; scopes por HTTP',async t=>{
 const x=await setup(t),a=await x.person({phone:'1112345678'});await x.person({phone:'1112345678'});
 for(const name of ['Oficinista','Apóstol','Administrador General']){const role=(await x.f.pool.query('SELECT id FROM roles WHERE name=$1',[name])).rows[0];const acc=await account(x.f,[{roleId:role.id,scopeType:'global'}]);const u=await principal(x.f.pool,acc.id);assert.equal((await x.service.people({},u)).total,2);assert.equal((await x.service.cells({},u)).total,0);assert.equal(publicUser(u).access.paths.filter(p=>p.path==='/oficina/calidad').length,1);}
 const acc=await account(x.f,[]);await x.f.pool.query("INSERT INTO user_permissions(id,user_id,permission,scope_type,scope_id) VALUES(gen_random_uuid(),$1,'personas.ver','person',$2),(gen_random_uuid(),$1,'personas.calidad','person',$2)",[acc.id,a.id]);const s=await testServer(x.f),api=httpClient(s.base);await api.login(acc);const res=await api.request('/api/office/quality/people');assert.equal(res.status,200);const data=await res.json();assert.equal(data.total,1);assert.equal(data.summary.duplicates,0);assert.equal(data.items[0].id,a.id);assert.equal((await api.request('/api/office/quality/cells')).status,403);
});
test('1.6 timezone configurable validada y aplicada a cumpleaños en backend',async t=>{
 const x=await setup(t);await x.person({birthDate:'2000-12-31'});const clock=()=>new Date('2027-01-01T01:00:00Z');
 const ar=createOfficeService(x.f.pool,{timezone:'America/Argentina/Buenos_Aires',now:clock}),tokyo=createOfficeService(x.f.pool,{timezone:'Asia/Tokyo',now:clock});assert.equal((await ar.birthdays({view:'today'},x.user)).total,1);assert.equal((await tokyo.birthdays({view:'today'},x.user)).total,0);
 assert.throws(()=>readConfig({DATABASE_URL:'postgresql://example.test/test',SESSION_SECRET:'a0123456789bcdef'.repeat(4),APP_TIMEZONE:'Invalid/Zone'}));
});
