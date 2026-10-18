import {createIntegrationAttendance,integrationList} from '../newcomers/attendance.mjs';
import {indicators} from '../followup/leader.mjs';
import {transaction} from '../db/pool.mjs';
import {principal} from '../identity/authorization.mjs';
import {createMeetingsService} from '../meetings/service.mjs';
import * as meetingRepo from '../meetings/repository.mjs';
import {uuid,shape,page,fail} from '../meetings/policy.mjs';
import {weekStart,addDays,temporalState} from '../../src/domain/meeting.js';
import {cellDTO,personDTO,meetingDTO} from './projection.mjs';
import * as r from './repository.mjs';
const denied=()=>fail('No tenés acceso a esta célula o a sus datos.',403);
function enabled(user){if(!user)fail('Iniciá sesión para continuar.',401);if(!user.grants.some(g=>g.permission==='lider.portal'&&g.scope_type==='global'))denied();}
// This principal is private to the adapter. It is NEVER returned, stored in a session,
// or accepted from request JSON. Normal /people, /cells and /meetings grants are unchanged.
function meetingContext(ctx,user,cellId,personIds=[]){return {requestId:ctx.requestId,client:ctx.client,user:{id:user.id,grants:[...['ver','generar','cargar','editar'].map(p=>({permission:'asistencia.'+p,scope_type:'cell',scope_id:cellId})),...personIds.map(id=>({permission:'personas.ver',scope_type:'person',scope_id:id}))]}};}
export function createLeaderService(pool){
 async function run(cellId,ctx,fn){if(!ctx.user?.id)fail('Iniciá sesión para continuar.',401);if(cellId)uuid(cellId);
  return transaction(pool,async db=>{
   // Serializes account relinking with this request. Cell locks use the same order as memberships.
   await db.query('SELECT id FROM users WHERE id=$1 FOR SHARE',[ctx.user.id]);let user=await principal(db,ctx.user.id);enabled(user);
   const ids=cellId?[cellId]:user.leaderCellIds;
   if(ids.length)await db.query('SELECT id FROM cells WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[ids]);
   user=await principal(db,ctx.user.id);enabled(user);if(cellId&&!user.leaderCellIds.includes(cellId))denied();
   return fn(db,user,{...ctx,client:db});
  });
 }
 async function entry(ctx){return run(null,ctx,async(db,user)=>({cells:(await db.query('SELECT id,"displayCode","meetingDay","meetingTime" FROM cells WHERE id=ANY($1::uuid[]) ORDER BY "displayCode"',[user.leaderCellIds])).rows.map(cellDTO)}));}
 async function prepare(cellId,input,ctx){shape(input,['from','to']);return run(cellId,ctx,(db,user,c)=>createMeetingsService(db).generate({...input,cellId},meetingContext(c,user,cellId)));}
 async function dashboard(cellId,ctx){return run(cellId,ctx,async(db,user,c)=>{
  const cell=(await db.query('SELECT id,"displayCode","meetingDay","meetingTime" FROM cells WHERE id=$1',[cellId])).rows[0];
  const from=addDays(weekStart(),-21),to=addDays(weekStart(),13),data=await createMeetingsService(db).list({cellId,from,to},meetingContext(c,user,cellId));
  const meetings=data.items.map(meetingDTO).sort((a,b)=>a.date.localeCompare(b.date));return {cell:cellDTO(cell),newcomers:await integrationList(db,cellId),members:await r.count(db,cellId),birthdays:await r.birthdays(db,cellId),current:meetings.find(m=>m.date>=weekStart()&&m.date<=addDays(weekStart(),6))||null,next:meetings.find(m=>m.date>addDays(weekStart(),6))||null,recent:meetings.filter(m=>m.date<weekStart()).reverse()};
 });}
 async function members(cellId,q,ctx){const pg=page(q);if(q.q!=null&&(typeof q.q!=='string'||q.q.length>100))fail('Búsqueda no válida.');return run(cellId,ctx,async(db,user)=>{const data=await r.members(db,cellId,{q:q.q||'',page:pg}),values=await indicators(db,user,cellId,data.items.map(p=>p.id));return {...data,items:data.items.map(p=>({...p,...(values[p.id]?{indicator:values[p.id]}:{})}))};});}
 async function person(cellId,id,ctx){uuid(id);return run(cellId,ctx,async(db,user,c)=>{const person=await r.person(db,cellId,id);if(!person)denied();const history=await createMeetingsService(db).person(id,{},meetingContext(c,user,cellId,[id]));const values=await indicators(db,user,cellId,[id]);return {...(values[id]?{indicator:values[id]}:{}),person:personDTO(person),cell:cellDTO((await db.query('SELECT id,"displayCode","meetingDay","meetingTime" FROM cells WHERE id=$1',[cellId])).rows[0]),attendance:history.items.slice(0,10).map(m=>({id:m.id,date:m.date,meetingStatus:m.meetingStatus,status:m.status}))};});}
 async function history(cellId,q,ctx){return run(cellId,ctx,async(db,user,c)=>{const data=await createMeetingsService(db).list({...q,cellId},meetingContext(c,user,cellId));return {page:data.page,pages:data.pages,from:data.from,to:data.to,items:data.items.map(meetingDTO)};});}
 async function meeting(cellId,id,ctx){uuid(id);return run(cellId,ctx,async(db,user,c)=>{const m=await meetingRepo.get(db,id);if(m.cellId!==cellId)denied();const rows=m.snapshotAt?await meetingRepo.records(db,id):await meetingRepo.expected(db,cellId,m.date);const detail=await createMeetingsService(db).detail(id,meetingContext(c,user,cellId,rows.map(p=>p.personId))),dto=meetingDTO(detail),current=new Set(await r.currentIds(db,cellId));dto.records=dto.records.map(p=>({...p,canOpenProfile:current.has(p.personId)}));return dto;});}
 async function status(cellId,id,ctx){uuid(id);return run(cellId,ctx,async db=>{const m=await meetingRepo.get(db,id);if(m.cellId!==cellId)denied();return {id:m.id,status:m.status,version:m.version,temporal:temporalState(m)};});}
 async function action(cellId,id,input,ctx){uuid(id);shape(input,['action','version','notes','records']);if(!['OPEN','SAVE'].includes(input.action))denied();
  return run(cellId,ctx,async(db,user,c)=>{const m=await meetingRepo.get(db,id);if(m.cellId!==cellId)denied();const rows=m.snapshotAt?await meetingRepo.records(db,id):await meetingRepo.expected(db,cellId,m.date);
   const saved=await createMeetingsService(db).action(id,input,meetingContext(c,user,cellId,rows.map(p=>p.personId)));return meetingDTO(saved);
  });
 }
 async function newcomerAttendance(cellId,id,input,ctx){return run(cellId,ctx,(db,user,c)=>input?createIntegrationAttendance(db).save(id,input,c,{leader:true,cellId}):createIntegrationAttendance(db).roster(id,c,{leader:true,cellId}));}
 return {newcomerAttendance,entry,prepare,dashboard,members,person,history,meeting,status,action};
}
