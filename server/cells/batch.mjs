import {transaction} from '../db/pool.mjs';
import {DomainError} from '../core/errors.mjs';
import {appendAudit} from '../audit/repository.mjs';
import {requirePermission,assertPerson,scopeFor} from '../identity/authorization.mjs';
import {listPeople} from '../people/repository.mjs';
import {sexCellWarning} from '../../src/domain/import-normalization.js';
import {cellAccess,cellCapabilities,shape,uuid,dateAndReason,version,active,fail} from './policy.mjs';
import * as r from './repository.mjs';
export async function candidates(pool,id,query,{user}){
 cellAccess(user,'celulas.ver',id);cellAccess(user,'celulas.gestionar_integrantes',id);
 const read=requirePermission(user,'personas.ver'),cell=await r.get(pool,id);active(cell);
 const page=await listPeople(pool,{q:query.q,page:query.page,pageSize:20},read);
 const info=await r.availability(pool,page.items.map(p=>p.id)),visible=scopeFor(user,'celulas.ver'),targetTransfer=cellCapabilities(user,id).transferir;
 return {...page,canCreate:scopeFor(user,'personas.crear').all,items:page.items.map(p=>{
  const current=info.find(x=>x.id===p.id),state=!current.cellId?'AVAILABLE':current.cellId===id?'HERE':'OTHER';
  const canSee=current.cellId&&(visible.all||visible.ids.includes(current.cellId));
  return {...p,sex:current.sex,state,warning:sexCellWarning(current.sex,cell.gender),current:canSee?{cellId:current.cellId,displayCode:current.displayCode,version:current.cellVersion,membershipId:current.membershipId,role:current.role}:null,canTransfer:state==='OTHER'&&Boolean(canSee)&&targetTransfer&&cellCapabilities(user,current.cellId).transferir};
 })};
}
// Fixed MEMBER role keeps the common workflow short. Promotions use the existing operation.
// All-or-nothing, including audit/events. No per-person HTTP calls and no partial success.
export async function assignBatch(pool,id,input,{user,requestId,client}={}){
 shape(input,['personIds','date','reason','version']);uuid(id);dateAndReason(input);
 cellAccess(user,'celulas.ver',id);cellAccess(user,'celulas.gestionar_integrantes',id);
 if(!Array.isArray(input.personIds)||!input.personIds.length||input.personIds.length>500)fail('Seleccioná entre 1 y 500 personas.');
 const ids=input.personIds;ids.forEach(uuid);if(new Set(ids).size!==ids.length)fail('El lote contiene personas repetidas.');
 const scope=requirePermission(user,'personas.ver');ids.forEach(id=>assertPerson(scope,id));
 const execute=async db=>{
  await r.lockCells(db,[id]);await r.lockPeople(db,ids);const cell=await r.get(db,id);version(cell,input.version);active(cell,input.date);
  const current=await r.availability(db,ids),conflicts=current.filter(p=>p.cellId).map(p=>({personId:p.id,state:p.cellId===id?'HERE':'OTHER'}));
  if(conflicts.length)throw new DomainError(409,'No se agregó ninguna persona. Algunas ya tienen célula activa; revisá la selección.',{code:'BATCH_CONFLICT',conflicts});
  const ended=await r.latestEnds(db,ids);if(ended.some(p=>p.date&&p.date>input.date))fail('La fecha se superpone con una pertenencia anterior. No se agregó ninguna persona.');
  const operationId=await r.operation(db,{kind:'BATCH_ASSIGN',source:id,date:input.date,reason:input.reason,actorId:user.id}),created=[];
  for(const personId of ids){const m=await r.start(db,{cellId:id,personId,role:'MEMBER',date:input.date,operationId});created.push(m);await r.event(db,{cellId:id,personId,operationId,summary:'Asignación como Miembro en carga masiva.',date:input.date,actorId:user.id});}
  await r.touch(db,id,input.date);
  await appendAudit(db,{actorId:user.id,action:'CELL_BATCH_ASSIGN',entity:'CELL',entityId:id,changes:created.map(m=>({field:'membership',before:null,after:m})),context:{operationId,requestId,count:created.length,effectiveDate:input.date,reason:input.reason||null}});
  return {count:created.length,operationId,cell:await r.get(db,id),warnings:current.filter(p=>sexCellWarning(p.sex,cell.gender)).map(p=>({personId:p.id,message:sexCellWarning(p.sex,cell.gender)}))};
 };
 try{return client?await execute(client):await transaction(pool,execute);}catch(e){if(['23505','23514','23503'].includes(e.code))fail('El lote entró en conflicto con otra operación. No se agregó ninguna persona.',409);throw e;}
}
