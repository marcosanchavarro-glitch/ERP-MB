import {scopeFor} from '../identity/authorization.mjs';
import {canConsultOffices} from '../people/ecclesiastical.mjs';
import {DomainError} from '../core/errors.mjs';
const validId=id=>typeof id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
export function departmentScope(user,manage=false){
 if(!user)return {all:false,ids:[]};const institutional=canConsultOffices(user)&&(!manage||scopeFor(user,'admin.usuarios.gestionar').all);
 const keys=manage?['departamentos.gestionar']:['departamentos.ver','departamentos.gestionar'],grants=user.grants.filter(g=>keys.includes(g.permission));
 return {all:institutional||grants.some(g=>g.scope_type==='global'),ids:[...new Set(grants.filter(g=>g.scope_type==='area'&&validId(g.scope_id)).map(g=>g.scope_id))]};
}
export function explicitDepartment(user,id,manage=false){const keys=manage?['departamentos.gestionar']:['departamentos.ver','departamentos.gestionar'];return Boolean(user?.grants.some(g=>keys.includes(g.permission)&&(g.scope_type==='global'||g.scope_type==='area'&&g.scope_id===id)));}
export function departmentAccess(user,id,manage=false){if(!user)throw new DomainError(401,'Iniciá sesión para continuar.');const scope=departmentScope(user,manage);if(!scope.all&&(id?!scope.ids.includes(id):!scope.ids.length))throw new DomainError(id?404:403,id?'No encontramos este departamento.':'Esta consulta no está disponible.');return scope;}
export function departmentPeople(user,id){return explicitDepartment(user,id)?{all:true,ids:[]}:scopeFor(user,'personas.ver');}
export const departmentPersonAllowed=(user,id,personId)=>{const scope=departmentPeople(user,id);return scope.all||scope.ids.includes(personId);};
