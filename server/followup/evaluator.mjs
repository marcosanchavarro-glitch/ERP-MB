import {randomUUID} from 'node:crypto';
import {appendAudit} from '../audit/repository.mjs';
import {calculate,absencePolicy} from './policy.mjs';
export async function event(db,{personId,caseId=null,alertId=null,action,data={},actorId='system:absence-evaluator',origin='AUTOMATIC'}){
 await db.query('INSERT INTO followup_events(id,person_id,case_id,alert_id,action,actor_id,origin,data) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),personId,caseId,alertId,action,actorId,origin,JSON.stringify(data)]);
 await appendAudit(db,{actorId,action:'FOLLOWUP_'+action,entity:caseId?'FOLLOWUP_CASE':'FOLLOWUP_ALERT',entityId:caseId||alertId||personId,changes:[{field:'event',before:null,after:data}],context:{personId,origin}});
}
export async function validRecords(db,ids,cellId=null){return (await db.query(`SELECT a."personId" AS person_id,m.id,m."cellId" AS cell_id,m.date,a.status
 FROM meeting_attendance a JOIN cell_meetings m ON m.id=a."meetingId"
 WHERE a."personId"=ANY($1::uuid[]) AND ($2::uuid IS NULL OR m."cellId"=$2)
 AND m.status IN ('RECORDED','CLOSED') AND a.status IN ('PRESENT','ABSENT')
 AND (m.date+m.time::time)<=(now() AT TIME ZONE 'America/Argentina/Buenos_Aires')
 AND EXISTS(SELECT 1 FROM cell_memberships cm WHERE cm."personId"=a."personId" AND cm."cellId"=m."cellId" AND cm."startDate"<=m.date AND (cm."endDate" IS NULL OR cm."endDate">m.date))
 ORDER BY a."personId",m.date,m.time,m.id`,[ids,cellId])).rows;}
export async function evaluate(db,ids){
 ids=[...new Set(ids)].sort();if(!ids.length)return;
 ids=(await db.query('SELECT id FROM people WHERE id=ANY($1::uuid[]) AND (EXISTS(SELECT 1 FROM meeting_attendance WHERE "personId"=people.id AND status IS NOT NULL) OR EXISTS(SELECT 1 FROM followup_metrics WHERE person_id=people.id)) ORDER BY id',[ids])).rows.map(p=>p.id);if(!ids.length)return;
 await db.query('SELECT id FROM people WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[ids]);
 const records=await validRecords(db,ids),group=new Map(ids.map(id=>[id,[]]));for(const row of records)group.get(row.person_id).push(row);
 for(const personId of ids){
  const metric=calculate(group.get(personId)),oldMetric=(await db.query('SELECT * FROM followup_metrics WHERE person_id=$1',[personId])).rows[0];
  await db.query(`INSERT INTO followup_metrics(person_id,streak,last8,valid_count,level,last_present,last_valid) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(person_id) DO UPDATE SET streak=$2,last8=$3,valid_count=$4,level=$5,last_present=$6,last_valid=$7,updated_at=now()`,[personId,metric.streak,metric.last8,metric.valid_count,metric.level,metric.last_present,metric.last_valid]);
  const alerts=(await db.query('SELECT * FROM followup_alerts WHERE person_id=$1 ORDER BY created_at,id FOR UPDATE',[personId])).rows,seen=new Set();
  for(const episode of metric.episodes){
   const rows=episode.rows,keys=rows.map(r=>r.id),key=keys[0],level=rows.length>=absencePolicy.urgent?'URGENT':'ATTENTION',status=episode.active?'ACTIVE':'RESOLVED',reached=rows[absencePolicy.attention-1];
   let alert=alerts.find(a=>a.episode_key===key)||alerts.find(a=>!seen.has(a.id)&&a.meeting_ids.some(id=>keys.includes(id)));
   if(!alert){alert={id:randomUUID()};await db.query('INSERT INTO followup_alerts(id,person_id,episode_key,cell_id,level,status,reached_date,streak,meeting_ids,resolution) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[alert.id,personId,key,reached.cell_id,level,status,reached.date,rows.length,keys,episode.active?null:'PRESENCE']);await event(db,{personId,alertId:alert.id,action:'ALERT_OPEN',data:{level,streak:rows.length,meetingIds:keys,reachedDate:reached.date,cellId:reached.cell_id}});}
   else if(alert.level!==level||alert.status!==status||alert.reached_date!==reached.date||JSON.stringify(alert.meeting_ids)!==JSON.stringify(keys)){
    await db.query('UPDATE followup_alerts SET level=$2,status=$3,streak=$4,meeting_ids=$5,resolution=$6,reached_date=$7,cell_id=$8,updated_at=now() WHERE id=$1',[alert.id,level,status,rows.length,keys,episode.active?null:'PRESENCE',reached.date,reached.cell_id]);
    await event(db,{personId,alertId:alert.id,action:alert.level!==level?'ALERT_LEVEL':status!==alert.status?'ALERT_RESOLVED':'ALERT_RECALCULATED',data:{before:{level:alert.level,status:alert.status,meetingIds:alert.meeting_ids},after:{level,status,meetingIds:keys},reason:'ATTENDANCE_OR_MEMBERSHIP_RECALCULATION'}});
   }
   seen.add(alert.id);
   if(level==='URGENT'){
    const existing=(await db.query("SELECT * FROM followup_cases WHERE person_id=$1 AND (status IN ('OPEN','FOLLOWING') OR alert_id=$2 OR id=$3) ORDER BY CASE WHEN id=$3 OR alert_id=$2 THEN 0 ELSE 1 END,opened_at DESC LIMIT 1",[personId,alert.id,alert.case_id||null])).rows[0];
    if(!existing){const caseId=randomUUID(),at=rows[absencePolicy.urgent-1];await db.query("INSERT INTO followup_cases(id,person_id,cell_id,alert_id,origin,reason,level) VALUES($1,$2,$3,$4,'AUTOMATIC',$5,'URGENT')",[caseId,personId,at.cell_id,alert.id,`${rows.length} ausencias consecutivas; umbral alcanzado el ${at.date}.`]);await db.query('UPDATE followup_alerts SET case_id=$2 WHERE id=$1',[alert.id,caseId]);await event(db,{personId,caseId,alertId:alert.id,action:'CASE_OPEN',data:{streak:rows.length,meetingIds:keys,cellId:at.cell_id,reachedDate:at.date}});}
    else if(existing.level!=='URGENT'&&['OPEN','FOLLOWING'].includes(existing.status)){await db.query("UPDATE followup_cases SET level='URGENT',version=version+1,updated_at=now(),last_action_at=now() WHERE id=$1",[existing.id]);await event(db,{personId,caseId:existing.id,alertId:alert.id,action:'CASE_ESCALATE',data:{before:existing.level,after:'URGENT'}});}
    if(existing&&!alert.case_id){await db.query('UPDATE followup_alerts SET case_id=$2 WHERE id=$1',[alert.id,existing.id]);await event(db,{personId,caseId:existing.id,alertId:alert.id,action:'CASE_EPISODE',data:{meetingIds:keys,reason:'Episodio asociado al caso existente.'}});}
   }
  }
  for(const alert of alerts.filter(a=>!seen.has(a.id)&&a.resolution!=='RECALCULATED')){await db.query("UPDATE followup_alerts SET status='RESOLVED',resolution='RECALCULATED',updated_at=now() WHERE id=$1",[alert.id]);await event(db,{personId,alertId:alert.id,action:'ALERT_RECALCULATED',data:{reason:'ATTENDANCE_OR_MEMBERSHIP_CORRECTION',before:alert.status,after:'RESOLVED'}});}
  if(oldMetric?.streak>0&&metric.streak===0&&metric.last_present!==oldMetric.last_present)await event(db,{personId,action:'RETURNED',data:{date:metric.last_present,caseRemainsOpen:true}});
 }
}
export async function flushEvaluation(db){const ids=(await db.query('DELETE FROM followup_dirty WHERE transaction_id=txid_current() RETURNING person_id')).rows.map(r=>r.person_id);await evaluate(db,ids);}
