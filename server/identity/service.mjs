import argon2 from 'argon2';
import {randomUUID,randomBytes} from 'node:crypto';
import {transaction} from '../db/pool.mjs';
import {appendAudit} from '../audit/repository.mjs';
import {DomainError} from '../core/errors.mjs';
export const hashOptions={type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1};
export function validateAccount(username,password) {
 if(typeof username!=='string'||! /^[a-z0-9@._+-]{3,100}$/i.test(username)||typeof password!=='string'||password.length<14||password.length>256)throw new DomainError(422,'Usá un usuario válido y una contraseña de 14 a 256 caracteres.');
}
export async function createUser(pool,{username,password,personId=null,grants=[],actorId='system:account-cli',client:externalClient}) {
 validateAccount(username,password);
 const passwordHash=await argon2.hash(password,hashOptions),id=randomUUID();
 const save=async client=>{
  await client.query('INSERT INTO users(id,username,password_hash,person_id) VALUES($1,$2,$3,$4)',[id,username.toLowerCase(),passwordHash,personId]);
  for(const grant of grants)await client.query('INSERT INTO user_roles(id,user_id,role_id,scope_type,scope_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),id,grant.roleId,grant.scopeType,grant.scopeId || null]);
  await appendAudit(client,{actorId,action:'USER_CREATE',entity:'USER',entityId:id});
 };if(externalClient)await save(externalClient);else await transaction(pool,save);return {id,username:username.toLowerCase()};
}
export async function adminRole(pool) {
 return transaction(pool,async client=>{
  const {rows}=await client.query("INSERT INTO roles(id,name) VALUES($1,'Administrador General') ON CONFLICT(name) DO UPDATE SET name=excluded.name RETURNING id",[randomUUID()]);
  const id=rows[0].id;
  await client.query('INSERT INTO role_permissions(role_id,permission) SELECT $1,key FROM permissions WHERE key=ANY($2::text[]) ON CONFLICT DO NOTHING',[id,['personas.ver','personas.crear','personas.editar','personas.historial','celulas.ver','celulas.crear','celulas.editar','celulas.gestionar_integrantes','celulas.transferir','celulas.cerrar','asistencia.ver','asistencia.generar','asistencia.cargar','asistencia.editar','asistencia.cerrar','asistencia.cancelar','asistencia.reabrir','seguimiento.ver','seguimiento.gestionar','admin.usuarios.ver','admin.usuarios.gestionar','admin.auditoria.ver','modulos.acceder']]);
  return id;
 });
}
export async function identityService(pool) {
 // The same Argon2 work is performed for nonexistent accounts; no user enumeration message.
 const dummy=await argon2.hash(randomBytes(32),hashOptions);
 return {
  async authenticate(username,password) {
   if(typeof username!=='string'||typeof password!=='string'||username.length>100||password.length>256)throw new DomainError(401,'Usuario o contraseña incorrectos.');
   const user=(await pool.query('SELECT id,username,password_hash,active FROM users WHERE username=$1',[username.toLowerCase().trim()])).rows[0];
   const valid=await argon2.verify(user?.password_hash || dummy,password);
   if(!user?.active||!valid)throw new DomainError(401,'Usuario o contraseña incorrectos.');
   return {id:user.id,username:user.username};
  }
 };
}
export async function revokeUserSessions(pool,userId) {await pool.query("DELETE FROM sessions WHERE sess->>'userId'=$1",[userId]);}
export async function deactivateUser(pool,userId) {
 await transaction(pool,async client=>{await client.query('UPDATE users SET active=false WHERE id=$1',[userId]);await revokeUserSessions(client,userId);await appendAudit(client,{actorId:'system:account-cli',action:'USER_DEACTIVATE',entity:'USER',entityId:userId});});
}
