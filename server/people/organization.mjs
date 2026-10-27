import {createHash} from 'node:crypto';
import {DomainError} from '../core/errors.mjs';
import {transaction} from '../db/pool.mjs';
import {appendAudit} from '../audit/repository.mjs';
import {scopeFor,requirePermission,assertPerson} from '../identity/authorization.mjs';
import {canConsultOffices,canManageOffice} from './ecclesiastical.mjs';
import {installationToday} from '../core/calendar.mjs';
import {normalizeText} from '../../src/domain/person.js';
import {shape,uuid} from '../cells/policy.mjs';
import {departmentAccess,explicitDepartment} from '../departments/policy.mjs';
const fail=(message,status=422)=>{throw new DomainError(status,message);};
const readAdmin=user=>{if(!canConsultOffices(user))fail('Esta consulta no está disponible.',403);return requirePermission(user,'personas.ver');};
const writeAdmin=user=>{if(!requirePermission(user,'admin.usuarios.gestionar').all)fail('Esta acción no está disponible.',403);};
const text=(value,max,required=false)=>{if(value==null&&!required)return null;if(typeof value!=='string'||value.trim().length>max||required&&!value.trim()||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))fail('Revisá los campos de texto.');return value.trim()||null;};
const date=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value||value<'1800-01-01'||value>installationToday())fail('Ingresá una fecha válida, no futura.');return value;};
const boolean=value=>{if(typeof value!=='boolean')fail('Revisá las opciones seleccionadas.');return value;};
const pageQuery=(q,allowed)=>{shape(q,allowed);if(Object.values(q).some(v=>typeof v!=='string'||v.length>200)||q.page&&!/^\d{1,6}$/.test(q.page))fail('Filtros no válidos.');return Math.max(1,Number(q.page)||1);};
const memberAccess=(user,id,write=false)=>{uuid(id);assertPerson(requirePermission(user,'personas.ver'),id);if(write&&!canManageOffice(user,id))fail('Esta acción no está disponible.',403);};
const historyScope=user=>scopeFor(user,'personas.historial');
async function mutate(pool,user,input,entityId,run){
 uuid(input.operationId);const fingerprint=createHash('sha256').update(JSON.stringify([user.id,entityId,Object.fromEntries(Object.keys(input).sort().map(k=>[k,input[k]]))])).digest('hex');
 try{return await transaction(pool,async db=>{
  // Serialize structural and membership writes, preserving cycle and interval invariants.
  await db.query('SELECT pg_advisory_xact_lock(404020)');const prior=(await db.query('SELECT fingerprint,result FROM organizational_events WHERE operation_id=$1',[input.operationId])).rows[0];if(prior){if(prior.fingerprint!==fingerprint)fail('La operación ya se utilizó con otros datos.',409);return prior.result;}
  const result=await run(db),value=result.value;
  await db.query('INSERT INTO organizational_events(entity_id,person_id,action,actor_id,before_value,after_value,operation_id,fingerprint,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[value.id,result.personId||null,result.action,user.id,JSON.stringify(result.before||null),JSON.stringify(result.after),input.operationId,fingerprint,JSON.stringify(value)]);
  await appendAudit(db,{actorId:user.id,action:result.action,entity:result.personId?'ORGANIZATION_ASSIGNMENT':'ORGANIZATIONAL_UNIT',entityId:value.id,changes:[{field:result.personId?'assignment':'unit',before:result.before||null,after:result.after}]});return value;
 });}catch(error){if(error.code==='23505')fail('Ya existe un área o una asignación equivalente.',409);if(error.code==='23514')fail('Revisá la jerarquía, el estado y los períodos: no se permiten ciclos ni asignaciones idénticas superpuestas.',409);throw error;}
}
export async function organizationMeta(db,scope,history={all:false,ids:[]}){
 const units=(await db.query('SELECT id,name,parent_id,active FROM organizational_units ORDER BY lower(name),id LIMIT 2001')).rows;
 const responsibilities=(await db.query('SELECT min(responsibility) name,responsibility_key AS key FROM organizational_assignments WHERE ($1 OR person_id=ANY($2::uuid[])) AND (end_date IS NULL OR $3 OR person_id=ANY($4::uuid[])) GROUP BY responsibility_key ORDER BY name LIMIT 100',[scope.all,scope.ids,history.all,history.ids||[]])).rows;
 return {units:units.slice(0,2000),more:units.length>2000,responsibilities};
}
export async function listOrganizationalUnits(pool,query,user){
 const scope=readAdmin(user);let page=pageQuery(query,['q','status','page','parentId']);const values=[],where=[],bind=v=>{values.push(v);return '$'+values.length;};
 if(query.q){where.push(`u.name ILIKE ${bind('%'+query.q.trim().replace(/[\\%_]/g,'\\$&')+'%')} ESCAPE '\\'`);}if(query.status){if(!['active','inactive'].includes(query.status))fail('Estado no válido.');where.push('u.active='+bind(query.status==='active'));}if(query.parentId){uuid(query.parentId);where.push('u.parent_id='+bind(query.parentId));}
 const filter=where.length?' WHERE '+where.join(' AND '):'',total=Number((await pool.query('SELECT count(*) n FROM organizational_units u'+filter,values)).rows[0].n),pages=Math.max(1,Math.ceil(total/20));page=Math.min(page,pages);
 const all=bind(scope.all),ids=bind(scope.ids),limit=bind(20),offset=bind((page-1)*20);
 const items=(await pool.query(`WITH counts AS(SELECT unit_id,count(DISTINCT person_id)::int members,count(DISTINCT person_id) FILTER(WHERE is_responsible)::int responsibles FROM organizational_assignments WHERE end_date IS NULL AND (${all} OR person_id=ANY(${ids}::uuid[])) GROUP BY unit_id) SELECT u.*,p.name parent_name,coalesce(c.members,0) members,coalesce(c.responsibles,0) responsibles FROM organizational_units u LEFT JOIN organizational_units p ON p.id=u.parent_id LEFT JOIN counts c ON c.unit_id=u.id${filter} ORDER BY lower(u.name),u.id LIMIT ${limit} OFFSET ${offset}`,values)).rows;
 return {items,total,page,pages,canManage:scopeFor(user,'admin.usuarios.gestionar').all,limited:!scope.all,...await organizationMeta(pool,scope,historyScope(user))};
}
export async function saveOrganizationalUnit(pool,id,input,user){
 readAdmin(user);writeAdmin(user);if(id)uuid(id);shape(input,['name','description','parentId','active','version','operationId']);const name=text(input.name,100,true),description=text(input.description,1000),active=boolean(input.active);if(input.parentId!==null)uuid(input.parentId);
 if(id&&(!Number.isInteger(input.version)||input.version<1))fail('Versión no válida.');return mutate(pool,user,input,id||'new-unit',async db=>{
  const old=id?(await db.query('SELECT * FROM organizational_units WHERE id=$1 FOR UPDATE',[id])).rows[0]:null;if(id&&!old)fail('No encontramos el área.',404);if(old&&old.version!==input.version)fail('El área cambió. Actualizá la consulta.',409);
  if(input.parentId&&!(await db.query('SELECT 1 FROM organizational_units WHERE id=$1',[input.parentId])).rowCount)fail('No encontramos el área superior.');
  const row=old?(await db.query('UPDATE organizational_units SET name=$2,description=$3,parent_id=$4,active=$5,version=version+1,updated_at=now(),updated_by=$6 WHERE id=$1 RETURNING *',[id,name,description,input.parentId,active,user.id])).rows[0]:(await db.query('INSERT INTO organizational_units(name,description,parent_id,active,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$5) RETURNING *',[name,description,input.parentId,active,user.id])).rows[0];
  return {value:{id:row.id,version:row.version},action:old?old.active&&!active?'ORGANIZATION_UNIT_DEACTIVATE':'ORGANIZATION_UNIT_UPDATE':'ORGANIZATION_UNIT_CREATE',before:old,after:row};
 });
}
async function personExists(db,id){const p=(await db.query('SELECT id,"birthDate" FROM people WHERE id=$1',[id])).rows[0];if(!p)fail('No encontramos a esta persona.',404);return p;}
async function insertAssignment(db,id,unitId,input,user){
 const person=await personExists(db,id),responsibility=text(input.responsibility,80,true),notes=text(input.notes,1000),start=date(input.startDate),isResponsible=boolean(input.isResponsible);if(person.birthDate&&start<person.birthDate)fail('La participación no puede ser anterior al nacimiento.');uuid(unitId);
 if(!(await db.query('SELECT 1 FROM organizational_units WHERE id=$1 AND active',[unitId])).rowCount)fail('Seleccioná un área activa.');
 return (await db.query('INSERT INTO organizational_assignments(person_id,unit_id,responsibility,responsibility_key,is_responsible,start_date,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[id,unitId,responsibility,normalizeText(responsibility),isResponsible,start,notes,user.id])).rows[0];
}
export async function assignOrganization(pool,id,input,user,{departmentId=null}={}){
 if(departmentId){departmentAccess(user,departmentId,true);if(input.unitId!==departmentId)fail('No encontramos este departamento.',404);assertPerson(requirePermission(user,'personas.ver'),id);if(!explicitDepartment(user,departmentId,true))memberAccess(user,id,true);}else memberAccess(user,id,true);
 shape(input,['unitId','responsibility','isResponsible','startDate','notes','operationId']);return mutate(pool,user,input,'assign:'+id,async db=>{const row=await insertAssignment(db,id,input.unitId,input,user);return {value:{id:row.id,version:row.version},personId:id,action:'ORGANIZATION_ASSIGN',after:row};});
}
export async function updateOrganizationAssignment(pool,id,assignmentId,input,user,end=false,{departmentId=null}={}){
 if(departmentId){departmentAccess(user,departmentId,true);if(!explicitDepartment(user,departmentId,true))memberAccess(user,id,true);}else memberAccess(user,id,true);
 uuid(assignmentId);shape(input,end?['endDate','version','operationId']:['responsibility','isResponsible','effectiveDate','notes','version','operationId']);
 if(!Number.isInteger(input.version)||input.version<1)fail('Versión no válida.');if(!end){text(input.responsibility,80,true);text(input.notes,1000);boolean(input.isResponsible);}
 return mutate(pool,user,input,(end?'end:':'change:')+assignmentId,async db=>{
  const old=(await db.query('SELECT * FROM organizational_assignments WHERE id=$1 AND person_id=$2 FOR UPDATE',[assignmentId,id])).rows[0];if(!old||departmentId&&old.unit_id!==departmentId)fail('No encontramos la participación.',404);if(old.end_date||old.version!==input.version)fail('La participación cambió. Actualizá la consulta.',409);
  const ending=date(end?input.endDate:input.effectiveDate);if(ending<old.start_date)fail('La finalización no puede ser anterior al inicio.');
  if(!end&&normalizeText(input.responsibility)===old.responsibility_key&&input.isResponsible===old.is_responsible&&((input.notes||'').trim()||null)===old.notes)fail('No hay cambios en la responsabilidad.');
  const closed=(await db.query('UPDATE organizational_assignments SET end_date=$2,ended_by=$3,ended_at=now(),version=version+1 WHERE id=$1 RETURNING *',[old.id,ending,user.id])).rows[0];
  const row=end?closed:await insertAssignment(db,id,old.unit_id,{...input,startDate:ending},user);
  return {value:{id:row.id,version:row.version},personId:id,action:end?'ORGANIZATION_PARTICIPATION_END':'ORGANIZATION_RESPONSIBILITY_CHANGE',before:old,after:row};
 });
}
export async function personOrganization(pool,id,user,query={}){
 memberAccess(user,id);await personExists(pool,id);let page=pageQuery(query,['page']);const scope=historyScope(user),history=scope.all||scope.ids.includes(id),total=Number((await pool.query('SELECT count(*) n FROM organizational_events WHERE person_id=$1',[id])).rows[0].n),pages=Math.max(1,Math.ceil(total/20));page=Math.min(page,pages);
 const assignments=(await pool.query(`SELECT a.*,u.name AS unit_name,u.active AS unit_active FROM organizational_assignments a JOIN organizational_units u ON u.id=a.unit_id WHERE a.person_id=$1 AND (a.end_date IS NULL OR $2) ORDER BY a.end_date IS NULL DESC,a.start_date DESC,a.id LIMIT 501`,[id,history])).rows;
 const events=history?(await pool.query('SELECT e.action,e.occurred_at,e.actor_id,coalesce(u.username,e.actor_id) actor_name,e.before_value,e.after_value FROM organizational_events e LEFT JOIN users u ON u.id::text=e.actor_id WHERE e.person_id=$1 ORDER BY e.sequence DESC LIMIT 20 OFFSET $2',[id,(page-1)*20])).rows:null;
 return {assignments:assignments.slice(0,500),more:assignments.length>500,events,history:history?{page,pages,total}:null,canManage:canManageOffice(user,id),...await organizationMeta(pool,requirePermission(user,'personas.ver'),scope)};
}
export async function organizationalUnitDetail(pool,id,user,query={}){
 const scope=readAdmin(user),hs=historyScope(user);uuid(id);let page=pageQuery(query,['page','participation']);if(query.participation&&!['current','history'].includes(query.participation))fail('Participación no válida.');const unit=(await pool.query('SELECT u.*,p.name parent_name FROM organizational_units u LEFT JOIN organizational_units p ON p.id=u.parent_id WHERE u.id=$1',[id])).rows[0];if(!unit)fail('No encontramos el área.',404);
 const values=[id,scope.all,scope.ids,hs.all,hs.ids,query.participation||'current'],condition=`unit_id=$1 AND ($2 OR person_id=ANY($3::uuid[])) AND (CASE WHEN $6='current' THEN end_date IS NULL ELSE end_date IS NOT NULL AND ($4 OR person_id=ANY($5::uuid[])) END)`,total=Number((await pool.query('SELECT count(*) n FROM organizational_assignments WHERE '+condition,values)).rows[0].n),pages=Math.max(1,Math.ceil(total/20));page=Math.min(page,pages);
 const assignments=(await pool.query(`SELECT a.*,p.names,p."lastNames" FROM organizational_assignments a JOIN people p ON p.id=a.person_id WHERE ${condition} ORDER BY a.is_responsible DESC,a.start_date DESC,a.id LIMIT 20 OFFSET $7`,[...values,(page-1)*20])).rows;
 const counts=(await pool.query('SELECT count(DISTINCT person_id)::int members,count(DISTINCT person_id) FILTER(WHERE is_responsible)::int responsibles FROM organizational_assignments WHERE unit_id=$1 AND end_date IS NULL AND ($2 OR person_id=ANY($3::uuid[]))',[id,scope.all,scope.ids])).rows[0];
 const events=(await pool.query('SELECT e.action,e.actor_id,coalesce(u.username,e.actor_id) actor_name,e.occurred_at,e.before_value,e.after_value FROM organizational_events e LEFT JOIN users u ON u.id::text=e.actor_id WHERE e.entity_id=$1 AND e.person_id IS NULL ORDER BY e.sequence DESC LIMIT 20',[id])).rows;
 return {unit,assignments,counts,events,total,page,pages,canManage:scopeFor(user,'admin.usuarios.gestionar').all,limited:!scope.all,canReadHistory:hs.all||hs.ids.length>0,...await organizationMeta(pool,scope,hs)};
}
