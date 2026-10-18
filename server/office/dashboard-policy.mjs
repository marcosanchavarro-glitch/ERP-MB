import {scopeFor} from '../identity/authorization.mjs';
export function officeDashboardAccess(user){return Boolean(user&&['personas.ver','celulas.ver','asistencia.ver','seguimiento.ver','nuevos.ver','personas.crear','celulas.crear'].some(p=>{const s=scopeFor(user,p);return s.all||s.ids.length;}));}
export function intersectScopes(...scopes){return scopes.reduce((a,b)=>a.all?b:b.all?a:{all:false,ids:a.ids.filter(id=>b.ids.includes(id))},{all:true,ids:[]});}
