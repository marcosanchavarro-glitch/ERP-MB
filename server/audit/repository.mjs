import {randomUUID} from 'node:crypto';
export async function appendAudit(client,{actorId,action,entity,entityId=null,changes=[],context={},occurredAt=new Date().toISOString(),id=randomUUID()}) {
 await client.query('INSERT INTO audit_events(id,actor_id,action,entity,entity_id,occurred_at,changes,context) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,actorId,action,entity,entityId,occurredAt,JSON.stringify(changes),JSON.stringify(context)]);
}
