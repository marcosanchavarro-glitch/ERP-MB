import {scopeFor,requirePermission} from '../identity/authorization.mjs';
import {canModule} from '../identity/modules.mjs';
import {DomainError} from '../core/errors.mjs';
export const evangelismCapabilities=user=>Object.fromEntries(['ver','crear','editar','recorridos','estados','estadisticas'].map(k=>[k,Boolean(user&&canModule(user,'territorio-evangelismo')&&scopeFor(user,'evangelismo.'+k).all)]));
export function evangelismAccess(user,action='ver'){
 requirePermission(user,'evangelismo.'+action);if(!evangelismCapabilities(user)[action])throw new DomainError(403,'Esta herramienta no está disponible.');
}
export const canEvangelism=user=>Boolean(user&&(evangelismCapabilities(user).ver||evangelismCapabilities(user).estadisticas));
