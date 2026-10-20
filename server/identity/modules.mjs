import {navigation} from '../../src/config.js';
import {DomainError} from '../core/errors.mjs';
export const moduleCatalog=navigation.filter(n=>n.path!=='/');
export const moduleNodes=moduleCatalog.flatMap(n=>[n,...n.children]);
export function canModule(user,id){const node=moduleNodes.find(n=>n.id===id);if(!user||!node)return false;const area=moduleCatalog.find(a=>a.id===id||a.children.some(c=>c.id===id));if(area.id==='administracion'&&!user.grants.some(g=>g.permission==='admin.usuarios.ver'&&g.scope_type==='global'))return false;return user.grants.some(g=>g.permission==='modulos.acceder'&&(g.scope_type==='global'||g.scope_type==='area'&&g.scope_id===area.id||g.scope_type==='subarea'&&g.scope_id===node.id));}
export function assertModule(user,id){if(!user)throw new DomainError(401,'Iniciá sesión para continuar.');if(!canModule(user,id))throw new DomainError(403,'No tenés permiso para realizar esta operación.');return moduleNodes.find(n=>n.id===id);}
