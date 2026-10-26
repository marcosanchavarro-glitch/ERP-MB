import {canModule} from '../identity/modules.mjs';
import {scopeFor,requirePermission} from '../identity/authorization.mjs';
import {DomainError} from '../core/errors.mjs';
export function territoryAccess(user,module='territorio-mapa'){
 if(!user)return false;
 const cells=scopeFor(user,'celulas.ver');
 return (canModule(user,module)||scopeFor(user,'territorio.ver').all)&&(cells.all||cells.ids.length>0);
}
export function territoryScope(user,module='territorio-mapa'){
 if(!user)requirePermission(user,'celulas.ver');
 if(!territoryAccess(user,module))throw new DomainError(403,'Esta sección no está disponible.');
 return scopeFor(user,'celulas.ver');
}
export function recommendationAccess(user,id,{edit=false}={}){
 if(!territoryAccess(user)||!canModule(user,'oficina-personas'))return false;
 return ['personas.ver',...(edit?['personas.editar']:[])].every(permission=>{const s=scopeFor(user,permission);return s.all||Boolean(id&&s.ids.includes(id));});
}
