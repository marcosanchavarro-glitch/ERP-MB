import {DomainError} from '../core/errors.mjs';
import {transaction} from '../db/pool.mjs';
import {appendAudit} from '../audit/repository.mjs';
import {scopeFor,requirePermission,assertPerson} from '../identity/authorization.mjs';
import {shape,uuid} from '../cells/policy.mjs';
import {treeSQL} from './organization.mjs';
import {evangelismAccess,evangelismCapabilities} from './evangelism-policy.mjs';
import {outingFields,validateOuting,outingTransitions,validCalendarDate,routeGeometry} from '../../src/domain/evangelism.js';
import {installationToday} from '../core/calendar.mjs';
const fail=(message,status=422)=>{throw new DomainError(status,message);};
const column={title:'title',date:'date',startTime:'start_time',endTime:'end_time',responsibleId:'responsible_id',organizer:'organizer',participantCount:'participant_count',unitId:'unit_id',description:'description',notes:'notes'};
export const outingDTO=r=>Object.fromEntries([['id',r.id],...outingFields.map(k=>[k,['startTime','endTime'].includes(k)?r[column[k]]?.slice(0,5)||null:r[column[k]]]),['status',r.status],['version',r.version],['responsibleName',r.responsible_name],['territoryLabel',r.territory_label],['cancellationReason',r.cancellation_reason],['createdAt',r.created_at],['updatedAt',r.updated_at]]);
const readRow=async(db,id,lock=false)=>{uuid(id);const row=(await db.query(`SELECT * FROM evangelism_outings WHERE id=$1${lock?' FOR UPDATE':''}`,[id])).rows[0];if(!row)fail('No encontramos esta salida.',404);return row;};
const checkVersion=(row,v)=>{if(!Number.isInteger(v)||row.version!==v)fail('Esta salida cambió. Actualizá el detalle antes de guardar.',409);};
async function record(db,id,action,changes,user,requestId){await appendAudit(db,{actorId:user.id,action,entity:'EVANGELISM_OUTING',entityId:id,changes,context:{requestId}});await db.query('INSERT INTO evangelism_events(outing_id,action,actor_id,fields) VALUES($1,$2,$3,$4)',[id,action,user.id,JSON.stringify(changes.map(c=>c.field))]);}
export async function saveOuting(pool,id,input,user,requestId){
 evangelismAccess(user);evangelismAccess(user,id?'editar':'crear');
 shape(input,['outing','version','participantIds']);shape(input.outing,outingFields);const {value,errors}=validateOuting(input.outing);if(Object.keys(errors).length)throw new DomainError(422,'Revisá los datos de la salida.',{fields:errors});
 return transaction(pool,async db=>{
  const old=id?await readRow(db,id,true):null;if(old)checkVersion(old,input.version);
  if(old?.status==='CANCELLED')fail('La salida está cancelada y conserva su información histórica.',409);
  if(old?.status==='COMPLETED'&&value.date>installationToday())fail('Una salida finalizada no puede tener una fecha futura.');
  const responsible=(await db.query('SELECT active FROM users WHERE id=$1',[value.responsibleId])).rows[0];if(!responsible||!responsible.active&&old?.responsible_id!==value.responsibleId)fail('Elegí un responsable habilitado.');
  const unit=(await db.query(`${treeSQL} SELECT id,level,path,active FROM tree WHERE id=$1`,[value.unitId])).rows[0];
  if(!unit||!['ZONE','SECTOR'].includes(unit.level))fail('Elegí una zona o sector registrado.');
  if(old?.unit_id!==value.unitId&&(!unit.active||(await db.query('SELECT 1 FROM territory_units WHERE id=ANY($1::uuid[]) AND NOT active LIMIT 1',[unit.path])).rowCount))fail('Elegí una zona o sector activo.');
  const previous=old?(await db.query('SELECT person_id FROM evangelism_participants WHERE outing_id=$1',[id])).rows.map(p=>p.person_id):[];let linked=previous;
  if(input.participantIds!==undefined){
   if(!Array.isArray(input.participantIds)||input.participantIds.length>200||new Set(input.participantIds).size!==input.participantIds.length)fail('Revisá los participantes vinculados (máximo 200).');
   const scope=requirePermission(user,'personas.ver');for(const personId of input.participantIds){uuid(personId);assertPerson(scope,personId);}
   if(input.participantIds.length!==(await db.query('SELECT id FROM people WHERE id=ANY($1::uuid[])',[input.participantIds])).rowCount)fail('No encontramos alguna de las personas seleccionadas.',404);
   linked=[...previous.filter(p=>!scope.all&&!scope.ids.includes(p)),...input.participantIds];
  }
  if(value.participantCount!==null&&value.participantCount<linked.length)fail('La cantidad informada no puede ser menor que los vínculos de participantes existentes.');
  const changes=outingFields.filter(k=>!old||JSON.stringify(outingDTO(old)[k]??null)!==JSON.stringify(value[k])).map(k=>({field:k,before:old?outingDTO(old)[k]:null,after:value[k]}));
  if(JSON.stringify([...previous].sort())!==JSON.stringify([...linked].sort()))changes.push({field:'participants',before:previous,after:linked});
  if(old&&!changes.length)return {id:old.id,version:old.version};
  const vals=outingFields.map(k=>value[k]);let row;
  if(old)row=(await db.query(`UPDATE evangelism_outings SET ${outingFields.map((k,i)=>column[k]+'=$'+(i+1)).join(',')},updated_by=$11,updated_at=now(),version=version+1 WHERE id=$12 RETURNING id,version`,[...vals,user.id,id])).rows[0];
  else row=(await db.query(`INSERT INTO evangelism_outings(${outingFields.map(k=>column[k]).join(',')},created_by,updated_by) VALUES(${vals.map((_,i)=>'$'+(i+1)).join(',')},$11,$11) RETURNING id,version`,[...vals,user.id])).rows[0];
  if(input.participantIds!==undefined||!old){await db.query('DELETE FROM evangelism_participants WHERE outing_id=$1',[row.id]);if(linked.length)await db.query('INSERT INTO evangelism_participants(outing_id,person_id) SELECT $1,unnest($2::uuid[])',[row.id,linked]);}
  await record(db,row.id,old?'EVANGELISM_UPDATE':'EVANGELISM_CREATE',changes,user,requestId);return row;
 });
}
export async function changeOutingState(pool,id,input,user,requestId){
 evangelismAccess(user);evangelismAccess(user,'estados');shape(input,['status','version','reason','confirmed']);
 if(input.confirmed!==true)fail('Confirmá el cambio de estado.');
 return transaction(pool,async db=>{const old=await readRow(db,id,true);checkVersion(old,input.version);
  if(!outingTransitions[old.status].includes(input.status))fail('Ese cambio de estado no está disponible.',409);
  if(['IN_PROGRESS','COMPLETED'].includes(input.status)&&old.date>installationToday())fail('La fecha de la actividad todavía no llegó.');
  const reason=input.status==='CANCELLED'&&typeof input.reason==='string'?input.reason.trim():null;if(input.status==='CANCELLED'&&(!reason||reason.length>1000))fail('Indicá el motivo de cancelación (hasta 1000 caracteres).');
  const saved=(await db.query('UPDATE evangelism_outings SET status=$2,cancellation_reason=$3,updated_by=$4,updated_at=now(),version=version+1 WHERE id=$1 RETURNING id,version,status',[id,input.status,reason,user.id])).rows[0];
  await record(db,id,'EVANGELISM_STATE_CHANGE',[{field:'status',before:old.status,after:input.status},{field:'cancellationReason',before:old.cancellation_reason,after:reason}],user,requestId);return saved;
 });
}
export async function saveOutingRoute(pool,id,input,user,requestId){
 evangelismAccess(user);evangelismAccess(user,'recorridos');shape(input,['geometry','version','privacyConfirmed']);if(input.privacyConfirmed!==true)fail('Revisá y confirmá que el trazado representa la actividad, sin domicilios ni recorridos individuales.');
 let route;try{route=routeGeometry(input.geometry);}catch(error){fail(error.message);}
 return transaction(pool,async db=>{const outing=await readRow(db,id,true);checkVersion(outing,input.version);if(outing.status==='CANCELLED')fail('La salida está cancelada.',409);
  const old=(await db.query('SELECT geometry,length_meters FROM evangelism_routes WHERE outing_id=$1',[id])).rows[0];
  await db.query('INSERT INTO evangelism_routes(outing_id,geometry,length_meters,updated_by) VALUES($1,$2,$3,$4) ON CONFLICT(outing_id) DO UPDATE SET geometry=excluded.geometry,length_meters=excluded.length_meters,updated_by=excluded.updated_by,updated_at=now()',[id,route.geometry,route.lengthMeters,user.id]);
  const saved=(await db.query('UPDATE evangelism_outings SET updated_by=$2,updated_at=now(),version=version+1 WHERE id=$1 RETURNING id,version',[id,user.id])).rows[0];
  await record(db,id,'EVANGELISM_ROUTE_UPDATE',[{field:'route',before:old||null,after:{geometry:route.geometry,length_meters:route.lengthMeters,source:'MANUAL'}}],user,requestId);return {...saved,...route,source:'MANUAL'};
 });
}
export async function outingDetail(pool,id,user,page=1){
 evangelismAccess(user);uuid(id);if(!/^\d{1,6}$/.test(String(page))||Number(page)<1)fail('Página inválida.');
 const row=(await pool.query(`${treeSQL} SELECT o.*,u.label territory_label,coalesce(nullif(concat_ws(' ',p.names,p."lastNames"),''),r.username) responsible_name,rt.geometry,rt.length_meters,rt.source FROM evangelism_outings o JOIN users r ON r.id=o.responsible_id LEFT JOIN people p ON p.id=r.person_id JOIN tree u ON u.id=o.unit_id LEFT JOIN evangelism_routes rt ON rt.outing_id=o.id WHERE o.id=$1`,[id])).rows[0];if(!row)fail('No encontramos esta salida.',404);
 const scope=scopeFor(user,'personas.ver'),participants=scope.all||scope.ids.length?(await pool.query('SELECT p.id,p.names,p."lastNames" FROM evangelism_participants ep JOIN people p ON p.id=ep.person_id WHERE ep.outing_id=$1 AND ($2 OR p.id=ANY($3::uuid[])) ORDER BY p."sortName",p.id',[id,scope.all,scope.ids])).rows:[];
 const history=(await pool.query('SELECT action,occurred_at,fields FROM evangelism_events WHERE outing_id=$1 ORDER BY sequence DESC LIMIT 21 OFFSET $2',[id,(Number(page)-1)*20])).rows;
 return {...outingDTO(row),route:row.geometry?{geometry:row.geometry,lengthMeters:row.length_meters,source:row.source}:null,participants,canManageParticipants:(scope.all||scope.ids.length>0)&&evangelismCapabilities(user).editar,capabilities:evangelismCapabilities(user),history:history.slice(0,20),historyPage:Number(page),historyMore:history.length>20};
}
