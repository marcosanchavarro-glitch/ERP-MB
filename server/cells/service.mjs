import {DomainError} from '../core/errors.mjs';
import {scheduleChanged,cellClosed} from '../meetings/schedules.mjs';
import {transaction} from '../db/pool.mjs';
import {appendAudit} from '../audit/repository.mjs';
import {scopeFor,requirePermission,assertPerson} from '../identity/authorization.mjs';
import {validateCell,cellRoles,validDate,validUuid,cellFields,cellLocationKeys,cellCompatibilityKeys} from '../../src/domain/cell.js';
import * as r from './repository.mjs';
import {cellAccess,cellCapabilities,fail,version,active,shape,role,dateAndReason,uuid,capacity} from './policy.mjs';
export {cellAccess,cellCapabilities} from './policy.mjs';
export function createCellsService(pool){
 async function run(fn){try{return await transaction(pool,fn);}catch(e){if(e.code==='23505')fail('El código activo o la pertenencia de la persona ya está en uso. Recargá y revisá la operación.',409);if(e.code==='23514'||e.code==='23503')fail('La operación no cumple las restricciones de integridad.',409);throw e;}}
 async function save(input,{id,user,requestId,client}={}){
  shape(input,['cell','version']);cellAccess(user,id?'celulas.editar':'celulas.crear',id);
  const {cell,errors}=validateCell(input.cell);if(Object.keys(errors).length)throw new DomainError(422,'Revisá los datos de la célula.',{fields:errors});
  const execute=async db=>{
   let old=null;if(id){await r.lockCells(db,[id]);old=await r.get(db,id);version(old,input.version);active(old);if(old.openedDate&&cell.openedDate!==old.openedDate)fail('La fecha de apertura conocida se conserva.');if(!old.openedDate&&cell.openedDate){const earliest=await r.earliestStart(db,id);if(earliest&&cell.openedDate>earliest)fail('La apertura no puede ser posterior a la primera pertenencia.');}}
   // Older internal clients omit territory fields; an unrelated edit must preserve them.
   if(old)for(const key of cellCompatibilityKeys)if(!Object.hasOwn(input.cell,key))cell[key]=old[key];
   const locationChanged=cellLocationKeys.some(k=>(old?.[k]??null)!==(cell[k]??null));
   if(old?.coordinateStatus==='VERIFIED'&&locationChanged)cell.coordinateStatus=cell.latitude==null?null:'PENDING';
   const checked=validateCell(cell);if(Object.keys(checked.errors).length)throw new DomainError(422,'Revisá la ubicación y compatibilidad.',{fields:checked.errors});
   Object.assign(cell,checked.cell);
   const saved=await r.saveCell(db,cell,id,locationChanged||(old?.coordinateStatus??null)!==(cell.coordinateStatus??null)),changes=cellFields.filter(f=>(old?.[f.key]??null)!==cell[f.key]).map(f=>({field:f.key,before:old?.[f.key]??null,after:cell[f.key]}));
   if((saved.locationUpdatedAt??null)!==(old?.locationUpdatedAt??null))changes.push({field:'locationUpdatedAt',before:old?.locationUpdatedAt??null,after:saved.locationUpdatedAt});
   await scheduleChanged(db,old,saved,{user,requestId});
   await appendAudit(db,{actorId:user.id,action:old?'CELL_UPDATE':'CELL_CREATE',entity:'CELL',entityId:saved.id,changes,context:{requestId}});
   await r.event(db,{cellId:saved.id,summary:old?'Información de la célula actualizada.':'Célula creada.',date:saved.lastEffectiveDate,actorId:user.id});return saved;
  };return client?execute(client):run(execute);
 }
 async function move(id,input,{user,requestId,client}={}){
  shape(input,['kind','personId','membershipId','destinationId','role','date','reason','version']);
  if(!['ASSIGN','ROLE','TRANSFER','END'].includes(input.kind))fail('Operación no válida.');uuid(id);uuid(input.personId);dateAndReason(input);
  const transfer=input.kind==='TRANSFER',perm=transfer?'celulas.transferir':'celulas.gestionar_integrantes';cellAccess(user,'celulas.ver',id);cellAccess(user,perm,id);assertPerson(requirePermission(user,'personas.ver'),input.personId);
  const dest=transfer?input.destinationId:id;if(transfer){uuid(dest);if(dest===id)fail('Elegí otra célula de destino.');cellAccess(user,'celulas.ver',dest);cellAccess(user,perm,dest);}
  if(input.kind!=='END')role(input.role);if(input.kind!=='ASSIGN')uuid(input.membershipId);
  const execute=async db=>{
   await r.lockCells(db,[id,dest]);await r.lockPeople(db,[input.personId]);const source=await r.get(db,id),target=dest===id?source:await r.get(db,dest);version(source,input.version);active(source,input.date);active(target,input.date);
   const old=await r.activeForPerson(db,input.personId);
   if(input.kind==='ASSIGN'){if(old)fail('La persona ya pertenece a una célula. Usá Transferir persona desde su célula actual.',409);const ended=await r.latestEnd(db,input.personId);if(ended&&input.date<ended)fail('La fecha se superpone con una pertenencia anterior.');}
   else {if(!old||old.cellId!==id||old.id!==input.membershipId)fail('La pertenencia cambió. Recargá la ficha.',409);if(input.date<old.startDate)fail('La fecha es anterior al inicio de la pertenencia.');if(input.kind==='ROLE'&&old.role===input.role)fail('Seleccioná una jerarquía diferente.');}
   if(input.kind!=='END')capacity((await r.currentMembers(db,dest)).filter(m=>m.id!==old?.id),input.role);
   const operationId=await r.operation(db,{kind:input.kind,source:id,destination:transfer?dest:null,date:input.date,reason:input.reason,actorId:user.id});
   if(old)await r.end(db,old.id,input.date,operationId);
   const next=input.kind==='END'?null:await r.start(db,{cellId:dest,personId:input.personId,role:input.role,date:input.date,operationId});
   const text={ASSIGN:`Asignación como ${cellRoles[input.role]}.`,ROLE:`Cambio de jerarquía: ${cellRoles[old?.role]} → ${cellRoles[input.role]}.`,TRANSFER:'Transferencia a otra célula.',END:'Finalización de pertenencia.'}[input.kind];
   await r.event(db,{cellId:id,personId:input.personId,operationId,summary:text,date:input.date,actorId:user.id});
   if(transfer)await r.event(db,{cellId:dest,personId:input.personId,operationId,summary:`Ingreso por transferencia como ${cellRoles[input.role]}.`,date:input.date,actorId:user.id});
   for(const cellId of new Set([id,dest]))await r.touch(db,cellId,input.date);
   await appendAudit(db,{actorId:user.id,action:'CELL_'+input.kind,entity:'CELL',entityId:id,changes:[{field:'membership',before:old||null,after:next}],context:{operationId,requestId,reason:input.reason||null,effectiveDate:input.date,destinationId:transfer?dest:null}});
   return {operationId,cell:await r.get(db,id)};
  };return client?execute(client):run(execute);
 }
 async function close(id,input,{user,requestId}={}){
  shape(input,['mode','date','reason','version','destinationId','allocations']);uuid(id);dateAndReason(input);
  if(!['CLOSE','ABSORB','REDISTRIBUTE'].includes(input.mode))fail('Seleccioná un tipo de cierre válido.');
  cellAccess(user,'celulas.ver',id);cellAccess(user,'celulas.cerrar',id);
  if(input.mode!=='CLOSE')cellAccess(user,'celulas.transferir',id);
  if(!Array.isArray(input.allocations)||input.allocations.length>5000)fail('Revisá la distribución de integrantes (máximo 5000).');
  if(input.mode==='CLOSE'&&input.allocations.length)fail('Un cierre total no tiene destinos.');
  if(input.mode==='ABSORB')uuid(input.destinationId);
  const destinations=[];
  for(const a of input.allocations){shape(a,['membershipId','destinationId','role']);uuid(a.membershipId);uuid(a.destinationId);role(a.role);if(a.destinationId===id)fail('La célula de origen no puede ser destino.');if(input.mode==='ABSORB'&&a.destinationId!==input.destinationId)fail('La absorción requiere un único destino.');destinations.push(a.destinationId);}
  if(input.mode==='ABSORB')destinations.push(input.destinationId);
  for(const dest of new Set(destinations)){if(dest===id)fail('Elegí otra célula de destino.');cellAccess(user,'celulas.ver',dest);cellAccess(user,'celulas.transferir',dest);}
  return run(async db=>{
   await r.lockCells(db,[id,...destinations]);const source=await r.get(db,id);version(source,input.version);active(source,input.date);
   const old=await r.currentMembers(db,id);const ps=requirePermission(user,'personas.ver');old.forEach(m=>assertPerson(ps,m.personId));await r.lockPeople(db,old.map(m=>m.personId));
   if(input.mode!=='CLOSE'&&(input.allocations.length!==old.length||new Set(input.allocations.map(a=>a.membershipId)).size!==old.length||input.allocations.some(a=>!old.some(m=>m.id===a.membershipId))))fail('La distribución debe incluir exactamente a todos los integrantes actuales.',409);
   for(const dest of new Set(destinations)){const cell=await r.get(db,dest);active(cell,input.date);const projected=await r.currentMembers(db,dest);for(const a of input.allocations.filter(a=>a.destinationId===dest)){capacity(projected,a.role);projected.push({role:a.role});}}
   const operationId=await r.operation(db,{kind:input.mode,source:id,destination:input.mode==='ABSORB'?input.destinationId:null,date:input.date,reason:input.reason,actorId:user.id});
   const changes=[];
   for(const m of old){if(input.date<m.startDate)fail('La fecha precede a una pertenencia.');await r.end(db,m.id,input.date,operationId);const a=input.allocations.find(a=>a.membershipId===m.id);let next=null;
    if(a){next=await r.start(db,{cellId:a.destinationId,personId:m.personId,role:a.role,date:input.date,operationId});await r.event(db,{cellId:a.destinationId,personId:m.personId,operationId,summary:`Ingreso por ${input.mode==='ABSORB'?'absorción':'redistribución'} como ${cellRoles[a.role]}.`,date:input.date,actorId:user.id});}
    changes.push({field:'membership',before:m,after:next});await r.event(db,{cellId:id,personId:m.personId,operationId,summary:a?'Pertenencia finalizada con traslado.':'Pertenencia finalizada por cierre total.',date:input.date,actorId:user.id});
   }
   for(const cellId of new Set([id,...destinations]))await r.touch(db,cellId,input.date);await r.closeCell(db,id,input.date);await cellClosed(db,id,input.date,{user,requestId});
   await r.event(db,{cellId:id,operationId,summary:{CLOSE:'Cierre total de la célula.',ABSORB:'Célula cerrada por absorción.',REDISTRIBUTE:'Célula cerrada con redistribución.'}[input.mode],date:input.date,actorId:user.id});
   await appendAudit(db,{actorId:user.id,action:'CELL_'+input.mode,entity:'CELL',entityId:id,changes:[{field:'status',before:'ACTIVE',after:'CLOSED'},...changes],context:{operationId,requestId,effectiveDate:input.date,reason:input.reason||null,destinationId:input.destinationId||null}});
   return {operationId,cell:await r.get(db,id)};
  });
 }
 return {save,move,close,get:id=>r.get(pool,id),profile:async(id,personScope)=>({...await r.get(pool,id),ageStatistics:await r.ageStatistics(pool,id,personScope)}),list:(q,s)=>r.list(pool,q,s),members:(id,q,s)=>r.members(pool,id,q,s),history:(id,q,s,cs={all:true,ids:[]})=>r.history(pool,id,q,s,cs),personHistory:(id,q,s)=>r.personHistory(pool,id,q,s)};
}
