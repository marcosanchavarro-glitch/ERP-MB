import {canModule} from '../identity/modules.mjs';
import {scopeFor,requirePermission} from '../identity/authorization.mjs';
import {DomainError} from '../core/errors.mjs';
export function territoryAccess(user){
 if(!user)return false;
 const cells=scopeFor(user,'celulas.ver');
 return (canModule(user,'territorio-mapa')||scopeFor(user,'territorio.ver').all)&&(cells.all||cells.ids.length>0);
}
export function territoryScope(user){
 if(!user)requirePermission(user,'celulas.ver');
 if(!territoryAccess(user))throw new DomainError(403,'Esta sección no está disponible.');
 return scopeFor(user,'celulas.ver');
}
