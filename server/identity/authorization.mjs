import {DomainError} from '../core/errors.mjs';
import {leaderCellIds} from '../cells/leader-access.mjs';
export async function principal(pool,id) {
 const user=(await pool.query('SELECT id,username,active FROM users WHERE id=$1',[id])).rows[0];
 if(!user?.active)return null;
 const grants=(await pool.query(`SELECT rp.permission,ur.scope_type,ur.scope_id::text,'PROFILE' AS source,r.name AS source_name FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 UNION ALL SELECT permission,scope_type,scope_id,'EXPLICIT' AS source,NULL AS source_name FROM user_permissions WHERE user_id=$1`,[id])).rows;
 const leaderPortal=grants.some(g=>g.permission==='lider.portal'&&g.scope_type==='global');
 return {...user,grants,leaderCellIds:leaderPortal?await leaderCellIds(pool,id):[]};
}
export function scopeFor(user,permission) {
 const grants=user.grants.filter(grant=>grant.permission===permission);
 // Future cell/area resolvers must translate membership into IDs; unsupported scopes fail closed.
 return {all:grants.some(grant=>grant.scope_type==='global'),ids:grants.filter(grant=>grant.scope_type===((permission.startsWith('celulas.')||permission.startsWith('asistencia.'))?'cell':'person')).map(grant=>grant.scope_id)};
}
export function requirePermission(user,permission) {
 if(!user)throw new DomainError(401,'Iniciá sesión para continuar.',{code:'SESSION_REQUIRED'});
 const scope=scopeFor(user,permission);
 if(!scope.all&&!scope.ids.length)throw new DomainError(403,'No tenés permiso para realizar esta operación.');
 return scope;
}
export function assertPerson(scope,id) {if(!scope.all&&!scope.ids.includes(id))throw new DomainError(404,'No encontramos a esta persona.');}
export function capabilities(user,id) {
 const allowed=permission=>{const scope=scopeFor(user,permission);return scope.all||(Boolean(id)&&scope.ids.includes(id));};
 return {create:scopeFor(user,'personas.crear').all,edit:allowed('personas.editar'),history:allowed('personas.historial'),account:scopeFor(user,'admin.usuarios.ver').all};
}
