import {transaction} from '../db/pool.mjs';
import {DomainError} from '../core/errors.mjs';
import {validUuid} from '../../src/domain/cell.js';
import {appendAudit} from '../audit/repository.mjs';
import {revokeUserSessions} from './service.mjs';
export async function leaderRole(db){const row=(await db.query("SELECT id FROM roles WHERE name='Portal líder'")).rows[0];if(!row)throw new Error('Aplicá las migraciones antes de habilitar el portal.');return row.id;}
// Administrative CLI only: never exposed through a web endpoint or invoked by membership writes.
export async function authorizeLeaderAccount(pool,{userId,personId,enabled=true,actorId='system:leader-account-cli'}){
 if(!validUuid(userId)||(enabled&&!validUuid(personId)))throw new DomainError(422,'Indicá UUID válidos de Usuario y Persona.');
 return transaction(pool,async db=>{const user=(await db.query('SELECT id,person_id FROM users WHERE id=$1 FOR UPDATE',[userId])).rows[0];if(!user)throw new DomainError(404,'Usuario no encontrado.');
  const roleId=await leaderRole(db),had=(await db.query('SELECT 1 FROM user_roles WHERE user_id=$1 AND role_id=$2 UNION ALL SELECT 1 FROM user_permissions WHERE user_id=$1 AND permission=$3',[userId,roleId,'lider.portal'])).rowCount>0;
  if(enabled){if(!(await db.query('SELECT id FROM people WHERE id=$1',[personId])).rowCount)throw new DomainError(404,'Persona no encontrada.');await db.query('UPDATE users SET person_id=$2 WHERE id=$1',[userId,personId]);await db.query("INSERT INTO user_roles(id,user_id,role_id,scope_type) VALUES(gen_random_uuid(),$1,$2,'global') ON CONFLICT DO NOTHING",[userId,roleId]);}
  else {await db.query('DELETE FROM user_roles WHERE user_id=$1 AND role_id=$2',[userId,roleId]);await db.query('DELETE FROM user_permissions WHERE user_id=$1 AND permission=ANY($2::text[])',[userId,['lider.portal','lider.indicadores']]);}
  if(had!==enabled||(enabled&&user.person_id!==personId)){await db.query('UPDATE users SET version=version+1,updated_at=now() WHERE id=$1',[userId]);await appendAudit(db,{actorId,action:'USER_LEADER_PORTAL',entity:'USER',entityId:userId,changes:[{field:'leaderPortal',before:had,after:enabled},{field:'personId',before:user.person_id,after:enabled?personId:user.person_id}]});await revokeUserSessions(db,userId);}
  return {id:userId,enabled};
 });
}
