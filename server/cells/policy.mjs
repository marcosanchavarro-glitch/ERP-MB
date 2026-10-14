import {DomainError} from '../core/errors.mjs';
import {scopeFor,requirePermission} from '../identity/authorization.mjs';
import {cellRoles,validDate,validUuid} from '../../src/domain/cell.js';
export function cellAccess(user,permission,id){const s=requirePermission(user,permission);if(id&&!s.all&&!s.ids.includes(id))throw new DomainError(404,'No encontramos esta célula.');if(!id&&!s.all)throw new DomainError(403,'Se requiere permiso global para crear células.');return s;}
export function cellCapabilities(user,id){return Object.fromEntries(['ver','crear','editar','gestionar_integrantes','transferir','cerrar'].map(k=>{const s=scopeFor(user,'celulas.'+k);return [k,s.all||(k!=='crear'&&s.ids.includes(id))];}));}
export const fail=(message,status=422)=>{throw new DomainError(status,message);};
export function version(cell,value){if(!Number.isInteger(value)||value<1)fail('Indicá la versión de la ficha.');if(cell.version!==value)fail('La célula cambió. Recargá la ficha y revisá la operación antes de confirmar.',409);}
export function active(cell,date){if(cell.status!=='ACTIVE')fail('La célula está cerrada.',409);if(date&&date<cell.lastEffectiveDate)fail(`La fecha debe ser igual o posterior al último movimiento (${cell.lastEffectiveDate}).`);}
export function shape(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))fail('La solicitud contiene campos no admitidos.');}
export function role(value){if(!Object.hasOwn(cellRoles,value))fail('Seleccioná Líder, Asistente o Miembro.');}
export function dateAndReason(input){if(!validDate(input.date))fail('Usá una fecha efectiva válida y no futura.');if(input.reason!=null&&(typeof input.reason!=='string'||input.reason.length>1000))fail('El motivo debe tener hasta 1000 caracteres.');}
export function uuid(value){if(!validUuid(value))fail('Identificador inválido.');}
export function capacity(members,roleName){const max=roleName==='LEADER'?2:roleName==='ASSISTANT'?3:Infinity;if(members.filter(m=>m.role===roleName).length>=max)fail(`La célula admite como máximo ${max} ${roleName==='LEADER'?'líderes':'asistentes'}.`,409);}
