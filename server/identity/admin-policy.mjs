import {requirePermission} from './authorization.mjs';
import {DomainError} from '../core/errors.mjs';
import {moduleCatalog,moduleNodes} from './modules.mjs';
import {uuid,shape,fail} from '../meetings/policy.mjs';
export const profileNames=['Administrador General','Apóstol','Oficinista','Recepción','Usuario por áreas'];
export function adminAccess(user,permission='ver'){if(!requirePermission(user,'admin.usuarios.'+permission).all)throw new DomainError(403,'No tenés permiso para realizar esta operación.');}
export async function validateGrants(db,input){
 if(!Array.isArray(input)||input.length>200)fail('Revisá los permisos (máximo 200).');
 const known=new Set((await db.query('SELECT key FROM permissions')).rows.map(p=>p.key)),seen=new Set();
 for(const g of input){shape(g,['permission','scopeType','scopeId']);if(!known.has(g.permission))fail('Permiso desconocido.');
  const supported=g.permission.startsWith('departamentos.')?['global','area']:['personas.crear','celulas.crear'].includes(g.permission)?['global']:g.permission==='modulos.acceder'?['global','area','subarea']:g.permission.startsWith('admin.')||g.permission.startsWith('lider.')?['global']:g.permission.startsWith('celulas.')||g.permission.startsWith('asistencia.')?['global','cell']:g.permission.startsWith('personas.')||g.permission.startsWith('seguimiento.')?['global','person']:['global'];
  if(!supported.includes(g.scopeType))fail('El alcance no corresponde a este permiso.');
  if(g.scopeType==='global'){if(g.scopeId!=null)fail('Un permiso global no lleva destino.');}
  else if(g.permission.startsWith('departamentos.')){uuid(g.scopeId);if(!(await db.query('SELECT 1 FROM organizational_units WHERE id=$1',[g.scopeId])).rowCount)fail('Departamento no válido.');}
  else if(['person','cell'].includes(g.scopeType)){uuid(g.scopeId);const table=g.scopeType==='person'?'people':'cells';if(!(await db.query(`SELECT id FROM ${table} WHERE id=$1`,[g.scopeId])).rowCount)fail('No encontramos el destino del alcance.');}
  else if(g.scopeType==='area'?!moduleCatalog.some(n=>n.id===g.scopeId):!moduleNodes.some(n=>n.id===g.scopeId&&!moduleCatalog.some(a=>a.id===n.id)))fail('Área o subárea inválida.');
  const key=[g.permission,g.scopeType,g.scopeId||''].join(':');if(seen.has(key))fail('Hay permisos repetidos.');seen.add(key);
 }
 return input;
}
