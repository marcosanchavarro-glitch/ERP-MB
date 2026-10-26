import {randomUUID,createHash} from 'node:crypto';
import {DomainError} from '../core/errors.mjs';
import {transaction} from '../db/pool.mjs';
import {appendAudit} from '../audit/repository.mjs';
import {scopeFor,requirePermission,assertPerson} from '../identity/authorization.mjs';
import {installationToday} from '../core/calendar.mjs';
import {shape,uuid} from '../cells/policy.mjs';
const fail=(message,status=422)=>{throw new DomainError(status,message);};
export const officeCatalog=db=>db.query('SELECT id,name,hierarchy_order AS "order",active FROM ecclesiastical_offices ORDER BY hierarchy_order').then(r=>r.rows);
export function canManageOffice(user,id){return Boolean(scopeFor(user,'admin.usuarios.gestionar').all&&(scopeFor(user,'personas.editar').all||scopeFor(user,'personas.editar').ids.includes(id)));}
export function canConsultOffices(user){return Boolean(user&&scopeFor(user,'admin.usuarios.ver').all&&(scopeFor(user,'personas.ver').all||scopeFor(user,'personas.ver').ids.length));}
export async function currentOffice(db,id){return (await db.query(`SELECT a.id,a.office_id AS "officeId",o.name,a.effective_date AS "startDate" FROM ecclesiastical_appointments a JOIN ecclesiastical_offices o ON o.id=a.office_id WHERE a.person_id=$1 ORDER BY a.effective_date DESC,a.sequence DESC LIMIT 1`,[id])).rows[0]||null;}
async function appendChange(db,{personId,officeId,effectiveDate,reason=null,actorId,operationId=randomUUID(),fingerprint,requestId}){
 const previous=await currentOffice(db,personId),id=randomUUID();
 await db.query('INSERT INTO ecclesiastical_appointments(id,person_id,office_id,effective_date,actor_id,reason,operation_id,fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,personId,officeId,effectiveDate,actorId,reason,operationId,fingerprint||'initial-formal-membership']);
 await appendAudit(db,{actorId,action:previous?'ECCLESIASTICAL_OFFICE_CHANGE':'ECCLESIASTICAL_OFFICE_ASSIGN',entity:'PERSON',entityId:personId,changes:[{field:'ecclesiasticalOffice',before:previous,after:{id,officeId,startDate:effectiveDate,reason}}],context:{requestId,formalMembershipConfirmed:true}});
 return {id};
}
// Explicit incorporation date on a NEW Matriz record is the existing formal-registration signal.
// Never infer membership from active status, visitors, cellular leadership or old records.
export async function initialMember(db,person,actorId,requestId){if(person.joinedDate)await appendChange(db,{personId:person.id,officeId:'MEMBER',effectiveDate:person.joinedDate,actorId,requestId});}
export async function officeProfile(pool,id,user,page=1){
 assertPerson(requirePermission(user,'personas.ver'),id);if(!(await pool.query('SELECT 1 FROM people WHERE id=$1',[id])).rowCount)fail('No encontramos a esta persona.',404);
 const current=await currentOffice(pool,id),historyScope=scopeFor(user,'personas.historial'),historyAllowed=historyScope.all||historyScope.ids.includes(id);let history=null;
 if(historyAllowed){if(!/^\d{1,6}$/.test(String(page))||Number(page)<1)fail('Página no válida.');const total=Number((await pool.query('SELECT count(*) n FROM ecclesiastical_appointments WHERE person_id=$1',[id])).rows[0].n),pages=Math.max(1,Math.ceil(total/20));page=Math.min(Number(page),pages);
  const items=(await pool.query(`SELECT p.id,p.office_id AS "officeId",o.name,p.effective_date AS "startDate",p.end_date AS "endDate",p.recorded_at AS "recordedAt",coalesce(u.username,p.actor_id) AS actor,p.reason,lag(o.name) OVER(ORDER BY p.effective_date,p.sequence) AS "previousName" FROM ecclesiastical_periods p JOIN ecclesiastical_offices o ON o.id=p.office_id LEFT JOIN users u ON u.id::text=p.actor_id WHERE p.person_id=$1 ORDER BY p.effective_date DESC,p.sequence DESC LIMIT 20 OFFSET $2`,[id,(page-1)*20])).rows;history={items,total,page,pages};
 }
 return {current,history,canManage:canManageOffice(user,id),offices:await officeCatalog(pool)};
}
export async function changeOffice(pool,id,input,user,requestId){
 assertPerson(requirePermission(user,'personas.ver'),id);if(!canManageOffice(user,id))fail('Esta acción no está disponible.',403);
 shape(input,['officeId','effectiveDate','reason','expectedId','operationId','confirmed']);uuid(id);uuid(input.operationId);if(input.expectedId!==null)uuid(input.expectedId);
 const date=input.effectiveDate;if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date<'1800-01-01'||date>installationToday())fail('Ingresá una fecha efectiva válida, no futura.');
 if(input.confirmed!==true)fail('Confirmá la incorporación formal y el cambio de cargo.');
 if(input.reason!=null&&(typeof input.reason!=='string'||input.reason.length>1000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(input.reason)))fail('Revisá el motivo (máximo 1000 caracteres).');
 const fingerprint=createHash('sha256').update(JSON.stringify([id,input.officeId,date,input.reason?.trim()||null,input.expectedId,user.id])).digest('hex');
 return transaction(pool,async db=>{
  const person=(await db.query('SELECT id,"birthDate","joinedDate" FROM people WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!person)fail('No encontramos a esta persona.',404);
  const replay=(await db.query('SELECT id,fingerprint FROM ecclesiastical_appointments WHERE operation_id=$1',[input.operationId])).rows[0];if(replay){if(replay.fingerprint!==fingerprint)fail('Esta operación ya se utilizó con otros datos.',409);return {id:replay.id,replayed:true};}
  const current=await currentOffice(db,id);if((current?.id||null)!==input.expectedId)fail('El cargo cambió. Actualizá la consulta antes de guardar.',409);
  if(!(await db.query('SELECT 1 FROM ecclesiastical_offices WHERE id=$1 AND active',[input.officeId])).rowCount)fail('Seleccioná un cargo válido.');
  if(current?.officeId===input.officeId)fail('La persona ya ocupa ese cargo.',409);
  if(current&&date<current.startDate)fail('La fecha debe ser igual o posterior al inicio del cargo vigente. No se reescribe el historial.');
  if(date<(person.birthDate||'1800-01-01')||date<(person.joinedDate||'1800-01-01'))fail('La fecha no puede ser anterior al nacimiento o a la incorporación registrada.');
  return appendChange(db,{personId:id,officeId:input.officeId,effectiveDate:date,reason:input.reason?.trim()||null,actorId:user.id,operationId:input.operationId,fingerprint,requestId});
 });
}
export async function administrativeOffices(pool,user){
 if(!canConsultOffices(user))fail('Esta consulta no está disponible.',403);const scope=requirePermission(user,'personas.ver');
 const rows=(await pool.query(`WITH latest AS (SELECT DISTINCT ON(person_id) person_id,office_id FROM ecclesiastical_appointments ORDER BY person_id,effective_date DESC,sequence DESC) SELECT o.id,o.name,o.hierarchy_order AS "order",o.active,count(l.person_id)::int AS count FROM ecclesiastical_offices o LEFT JOIN latest l ON l.office_id=o.id AND ($1::boolean OR l.person_id=ANY($2::uuid[])) GROUP BY o.id ORDER BY o.hierarchy_order`,[scope.all,scope.ids])).rows;
 return {items:rows,limited:!scope.all};
}
