import {DomainError} from '../core/errors.mjs';
import {scopeFor,requirePermission,assertPerson} from '../identity/authorization.mjs';
import {meetingDate,weekStart,addDays} from '../../src/domain/meeting.js';
import {today,validUuid} from '../../src/domain/cell.js';
export const fail=(message,status=422)=>{throw new DomainError(status,message);};
export function shape(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))fail('Campos no admitidos.');}
export function uuid(id){if(!validUuid(id))fail('Identificador inválido.');return id;}
export function access(user,permission,cellId){const s=requirePermission(user,'asistencia.'+permission);if(cellId&&!s.all&&!s.ids.includes(cellId))fail('No encontramos esta reunión o célula.',404);return s;}
export function caps(user,id){return Object.fromEntries(['ver','generar','cargar','editar','cerrar','cancelar','reabrir'].map(p=>{const s=scopeFor(user,'asistencia.'+p);return [p,s.all||(id?s.ids.includes(id):s.ids.length>0)];}));}
export function peopleAccess(user,rows){const s=requirePermission(user,'personas.ver');for(const r of rows)assertPerson(s,r.personId);}
export function version(row,v){if(!Number.isInteger(v)||v<1)fail('Indicá una versión válida.');if(row.version!==v)fail('La reunión cambió. Recargá y revisá antes de volver a guardar.',409);}
export function text(v,max=2000){if(v==null)return null;if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))fail('Revisá la observación y su longitud.');return v.trim()||null;}
export function range(q){const from=q.from||weekStart();if(!meetingDate(from))fail('Elegí una fecha válida para el período.');const to=q.to||addDays(from,6);if(!meetingDate(to)||to<from||Date.parse(to)-Date.parse(from)>34*86400000||to>addDays(today(),35))fail('Elegí un período de hasta 35 días, como máximo cinco semanas hacia adelante.');return {from,to};}
export function page(q){const p=Number(q.page||1);if(!Number.isInteger(p)||p<1||p>100000)fail('Página inválida.');return p;}
