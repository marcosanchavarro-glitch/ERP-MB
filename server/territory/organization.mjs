import {DomainError} from '../core/errors.mjs';
import {scopeFor} from '../identity/authorization.mjs';
import {territoryAccess,territoryScope} from './policy.mjs';
import {uuid,shape} from '../cells/policy.mjs';
import {transaction} from '../db/pool.mjs';
import {appendAudit} from '../audit/repository.mjs';
import {normalizeText} from '../../src/domain/person.js';
export const territoryLevels=['COUNTRY','PROVINCE','MUNICIPALITY','LOCALITY','ZONE','SECTOR'];
export const treeSQL=`WITH RECURSIVE tree AS (
 SELECT u.*,ARRAY[u.id] path,u.name::text label,u.name::text country,NULL::text province,NULL::text municipality,NULL::text locality,NULL::uuid locality_id
 FROM territory_units u WHERE parent_id IS NULL
 UNION ALL SELECT u.*,t.path||u.id,t.label||' → '||u.name,t.country,
 CASE WHEN u.level='PROVINCE' THEN u.name ELSE t.province END,
 CASE WHEN u.level='MUNICIPALITY' THEN u.name ELSE t.municipality END,
 CASE WHEN u.level='LOCALITY' THEN u.name ELSE t.locality END,
 CASE WHEN u.level='LOCALITY' THEN u.id ELSE t.locality_id END
 FROM territory_units u JOIN tree t ON u.parent_id=t.id
)`;
export function organizationScope(user){return territoryAccess(user,'territorio-analisis')?territoryScope(user,'territorio-analisis'):territoryScope(user);}
export function canManageTerritory(user){const s=organizationScope(user);return s.all&&(scopeFor(user,'celulas.editar').all||scopeFor(user,'admin.usuarios.gestionar').all);}
const manage=user=>{if(!canManageTerritory(user))throw new DomainError(403,'Esta herramienta no está disponible.');};
const lock=db=>db.query("SELECT pg_advisory_xact_lock(hashtext('halo-territory-organization'))");
export async function territorialUnits(db,user){
 const scope=organizationScope(user);
 const units=(await db.query(`${treeSQL} SELECT id,level,parent_id,name,description,active,survey_status,version,created_at,updated_at,updated_by,label,country,province,municipality,locality FROM tree t
 WHERE ($1 OR EXISTS(SELECT 1 FROM cell_territory ct JOIN tree leaf ON leaf.id=ct.unit_id WHERE ct.cell_id=ANY($2::uuid[]) AND t.id=ANY(leaf.path))) ORDER BY label,id LIMIT 2001`,[scope.all,scope.ids])).rows;
 const geography=(await db.query(`SELECT DISTINCT country,province,municipality,locality FROM cells WHERE ($1 OR id=ANY($2::uuid[])) AND status='ACTIVE' ORDER BY country,province,municipality,locality LIMIT 500`,[scope.all,scope.ids])).rows;
 return {items:units.slice(0,2000),more:units.length>2000,geography,canManage:canManageTerritory(user),completeScope:scope.all};
}
export async function saveTerritorialUnit(pool,id,input,user,requestId){
 manage(user);if(id)uuid(id);shape(input,['level','parentId','name','description','active','surveyStatus','version','geographyConfirmed']);
 const {level,parentId=null,name,description='',active=true,surveyStatus='PENDING'}=input;
 if(!territoryLevels.includes(level)||typeof name!=='string'||!name.trim()||name.length>100||typeof description!=='string'||description.length>1000||typeof active!=='boolean'||!['PENDING','REVIEWED'].includes(surveyStatus)||/[\u0000-\u001f]/.test(name+description))throw new DomainError(422,'Revisá los datos del territorio.');
 if(parentId!==null)uuid(parentId);
 if(territoryLevels.indexOf(level)<4&&input.geographyConfirmed!==true)throw new DomainError(422,'Confirmá que el nombre corresponde a una división geográfica real.');
 try{return await transaction(pool,async db=>{
 await lock(db);const old=id?(await db.query('SELECT * FROM territory_units WHERE id=$1 FOR UPDATE',[id])).rows[0]:null;
 if(id&&!old)throw new DomainError(404,'No encontramos este territorio.');
 if(old&&old.version!==input.version)throw new DomainError(409,'Este territorio cambió. Actualizá la lista antes de guardar.');
 const parent=parentId?(await db.query('SELECT level,active FROM territory_units WHERE id=$1',[parentId])).rows[0]:null;
 if((level==='COUNTRY'?parentId!==null:parent?.level!==territoryLevels[territoryLevels.indexOf(level)-1])||active&&parentId&&!parent?.active)throw new DomainError(422,'Elegí un nivel superior activo y compatible.');
 if(old&&(old.level!==level||old.parent_id!==parentId))throw new DomainError(422,'Para cambiar la jerarquía, registrá el nuevo territorio y reasigná las células explícitamente.');
 if(old&&!active&&(await db.query("SELECT 1 FROM cell_territory ct JOIN cells c ON c.id=ct.cell_id WHERE unit_id=$1 AND c.status='ACTIVE' LIMIT 1",[id])).rowCount)throw new DomainError(409,'Reasigná las células activas antes de desactivar este territorio.');
 const saved=old?(await db.query('UPDATE territory_units SET name=$2,description=$3,active=$4,survey_status=$5,updated_by=$6,updated_at=now(),version=version+1 WHERE id=$1 RETURNING *',[id,name.trim(),description.trim()||null,active,surveyStatus,user.id])).rows[0]:(await db.query('INSERT INTO territory_units(level,parent_id,name,description,active,survey_status,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[level,parentId,name.trim(),description.trim()||null,active,surveyStatus,user.id])).rows[0];
 await appendAudit(db,{actorId:user.id,action:old?old.active&&!active?'TERRITORY_UNIT_DEACTIVATE':'TERRITORY_UNIT_UPDATE':'TERRITORY_UNIT_CREATE',entity:'TERRITORY_UNIT',entityId:saved.id,changes:[{field:'unit',before:old,after:saved}],context:{requestId}});return saved;
 });}catch(e){if(e.code==='23505')throw new DomainError(409,'Ya existe ese nombre bajo el mismo nivel superior.');if(e.code==='23514')throw new DomainError(409,'Revisá la jerarquía y desactivá primero los territorios dependientes.');throw e;}
}
export async function assignTerritory(pool,cellId,input,user,requestId){
 manage(user);uuid(cellId);shape(input,['unitId','version']);if(input.unitId!==null)uuid(input.unitId);
 return transaction(pool,async db=>{
 await lock(db);const cell=(await db.query('SELECT id,status,country,province,municipality,locality FROM cells WHERE id=$1 FOR UPDATE',[cellId])).rows[0];
 if(!cell)throw new DomainError(404,'No encontramos esta célula.');if(cell.status!=='ACTIVE')throw new DomainError(409,'La célula está cerrada.');
 const old=(await db.query('SELECT * FROM cell_territory WHERE cell_id=$1 FOR UPDATE',[cellId])).rows[0];
 if(!Number.isInteger(input.version)||input.version!==(old?.version||0))throw new DomainError(409,'La asignación cambió. Actualizá antes de guardar.');
 if(input.unitId){const unit=(await db.query(`${treeSQL} SELECT * FROM tree WHERE id=$1`,[input.unitId])).rows[0];
 if(!unit||!['ZONE','SECTOR'].includes(unit.level)||!unit.active||(await db.query('SELECT 1 FROM territory_units WHERE id=ANY($1::uuid[]) AND NOT active LIMIT 1',[unit.path])).rowCount)throw new DomainError(422,'Elegí una zona o sector activo.');
 if(['country','province','municipality','locality'].some(k=>cell[k]&&normalizeText(cell[k])!==normalizeText(unit[k])))throw new DomainError(422,'La división geográfica no coincide con la ficha de la célula. Revisá sus datos antes de asignar.');
 }
 // Keep the row/version when unassigning so a stale request cannot overwrite a later assignment.
 if(old&&old.unit_id===input.unitId)return old;
 const saved=(await db.query('INSERT INTO cell_territory(cell_id,unit_id,updated_by) VALUES($1,$2,$3) ON CONFLICT(cell_id) DO UPDATE SET unit_id=excluded.unit_id,updated_by=excluded.updated_by,updated_at=now(),version=cell_territory.version+1 RETURNING *',[cellId,input.unitId,user.id])).rows[0];
 await appendAudit(db,{actorId:user.id,action:'CELL_TERRITORY_ASSIGN',entity:'CELL',entityId:cellId,changes:[{field:'territory',before:old||null,after:saved}],context:{requestId}});return saved;
 });
}
