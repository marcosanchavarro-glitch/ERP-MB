import {transaction} from '../db/pool.mjs';
import {scopeFor,requirePermission,assertPerson} from '../identity/authorization.mjs';
import {temporalState,weekStart} from '../../src/domain/meeting.js';
import * as p from './policy.mjs';
import * as r from './repository.mjs';
export function createMeetingsService(pool){
 // Only trusted callers can compose these operations within an existing transaction.
 const run=(ctx,fn)=>ctx.client?fn(ctx.client):transaction(pool,fn);
 async function generate(input,ctx){
  p.shape(input,['from','to','cellId']);const {from,to}=p.range(input),s=p.access(ctx.user,'generar',input.cellId);p.access(ctx.user,'ver',input.cellId);if(input.cellId)p.uuid(input.cellId);
  const view=scopeFor(ctx.user,'asistencia.ver');
  return run(ctx,async db=>{
   // Same lock order as Cell membership/schedule writes; no per-cell read loop.
   const cells=(await db.query('SELECT id FROM cells WHERE ($1 OR id=ANY($2::uuid[])) AND ($3 OR id=ANY($4::uuid[])) AND ($5::uuid IS NULL OR id=$5) ORDER BY id FOR UPDATE',[s.all,s.ids,view.all,view.ids,input.cellId||null])).rows.map(x=>x.id);
   const rows=(await db.query(`INSERT INTO cell_meetings(id,"cellId",week,date,time,"scheduleId","createdBy","updatedBy")
    SELECT gen_random_uuid(),c.id,w.week::date,d.date,s.time,s.id,$5,$5 FROM cells c
    CROSS JOIN generate_series($2::date,$3::date,interval '7 days') w(week)
    JOIN LATERAL (SELECT * FROM cell_schedules WHERE "cellId"=c.id AND "effectiveWeek"<=w.week ORDER BY "effectiveWeek" DESC,sequence DESC LIMIT 1) s ON true
    CROSS JOIN LATERAL (SELECT w.week::date+((s.day::int+6)%7) AS date) d
    WHERE c.id=ANY($1::uuid[]) AND s.day IS NOT NULL AND s.time IS NOT NULL
     AND d.date BETWEEN $4::date AND $6::date AND (c."openedDate" IS NULL OR d.date>=c."openedDate")
     AND (c."closedDate" IS NULL OR d.date<c."closedDate")
    ON CONFLICT("cellId",week) DO NOTHING RETURNING *`,[cells,weekStart(from),weekStart(to),from,ctx.user.id,to])).rows;
   if(rows.length){const data=JSON.stringify(rows.map(m=>({id:m.id,cellId:m.cellId,date:m.date,time:m.time})));
    await db.query(`INSERT INTO meeting_events(id,"meetingId",action,"actorId",changes) SELECT gen_random_uuid(),x.id,'GENERATE',$2,jsonb_build_array(jsonb_build_object('field','meeting','before',null,'after',to_jsonb(x))) FROM jsonb_to_recordset($1::jsonb) x(id uuid,"cellId" uuid,date text,time text)`,[data,ctx.user.id]);
    await db.query(`INSERT INTO audit_events(id,actor_id,action,entity,entity_id,changes,context) SELECT gen_random_uuid(),$2,'MEETING_GENERATE','MEETING',x.id,jsonb_build_array(jsonb_build_object('field','meeting','before',null,'after',to_jsonb(x))),jsonb_build_object('requestId',$3::text,'generation','on-demand') FROM jsonb_to_recordset($1::jsonb) x(id uuid,"cellId" uuid,date text,time text)`,[data,ctx.user.id,ctx.requestId||null]);
   }return {created:rows.length};
  });
 }
 async function detail(id,ctx){p.uuid(id);const m=await r.get(pool,id);p.access(ctx.user,'ver',m.cellId);const rows=m.snapshotAt?await r.records(pool,id):await r.expected(pool,m.cellId,m.date);p.peopleAccess(ctx.user,rows);return {...m,temporal:temporalState(m),records:rows,capabilities:p.caps(ctx.user,m.cellId)};}
 async function action(id,input,ctx){
  p.uuid(id);p.shape(input,['action','version','reason','notes','records']);
  if(!['OPEN','SAVE','CLOSE','CANCEL','REOPEN'].includes(input.action))p.fail('Acción no válida.');
  const notes=p.text(input.notes),reason=p.text(input.reason,1000);
  return run(ctx,async db=>{
   const m=await r.lock(db,id);p.access(ctx.user,'ver',m.cellId);p.version(m,input.version);
   // Serialize changes to qualifying meetings with explicit newcomer conversion.
   await db.query('SELECT id FROM newcomers WHERE id IN(SELECT newcomer_id FROM newcomer_attendance WHERE meeting_id=$1) ORDER BY id FOR UPDATE',[id]);
   const permission={OPEN:'cargar',SAVE:m.status==='RECORDED'?'editar':'cargar',CLOSE:'cerrar',CANCEL:'cancelar',REOPEN:'reabrir'}[input.action];p.access(ctx.user,permission,m.cellId);
   let rows=m.snapshotAt?await r.records(db,id):await r.expected(db,m.cellId,m.date);p.peopleAccess(ctx.user,rows);
   const transitions={OPEN:['SCHEDULED'],SAVE:['OPEN','RECORDED'],CLOSE:['RECORDED'],CANCEL:['SCHEDULED','OPEN','RECORDED'],REOPEN:['CLOSED']};
   if(!transitions[input.action].includes(m.status))p.fail('Esta acción no corresponde al estado actual de la reunión.',409);
   if(['OPEN','SAVE'].includes(input.action)&&temporalState(m)==='Próxima')p.fail('Todavía no llegó el día y horario de la reunión.');
   const changes=[];let status;
   if(input.action==='OPEN'){
    if(rows.length>5000)p.fail('La reunión supera el máximo de 5000 participantes.');
    await r.snapshot(db,m,rows);status='OPEN';changes.push({field:'participants',before:null,after:rows.map(x=>({personId:x.personId,membershipId:x.membershipId,role:x.role}))});
   }
   if(input.action==='SAVE'){
    if(!Array.isArray(input.records)||input.records.length>5000||input.records.length!==rows.length||new Set(input.records.map(x=>x?.personId)).size!==rows.length)p.fail('Revisá a todos los integrantes, sin omisiones ni duplicados.');
    const byId=new Map(rows.map(x=>[x.personId,x]));
    const values=input.records.map(v=>{p.shape(v,['personId','status','notes']);const old=byId.get(v.personId);if(!old||!['PRESENT','ABSENT'].includes(v.status))p.fail('Cada integrante debe tener una marca explícita: Presente o Ausente.');const value={personId:v.personId,status:v.status,notes:p.text(v.notes,500)};if(old.status!==value.status||old.notes!==value.notes)changes.push({field:'attendance',personId:v.personId,before:{status:old.status,notes:old.notes},after:{status:value.status,notes:value.notes}});return value;});
    await db.query(`UPDATE meeting_attendance a SET status=x.status,notes=x.notes,"updatedAt"=now() FROM jsonb_to_recordset($2::jsonb) x("personId" uuid,status text,notes text) WHERE a."meetingId"=$1 AND a."personId"=x."personId"`,[id,JSON.stringify(values)]);
    if(m.notes!==notes)changes.push({field:'notes',before:m.notes,after:notes});status='RECORDED';
   }
   if(input.action==='CLOSE'){if(rows.some(x=>!x.status))p.fail('La asistencia debe estar completa antes de cerrar.',409);status='CLOSED';}
   if(input.action==='REOPEN'){if(!reason)p.fail('Indicá el motivo de reapertura.');status='RECORDED';}
   if(input.action==='CANCEL'){
    if(!reason)p.fail('Indicá el motivo de cancelación.');
    if(m.snapshotAt){changes.push(...rows.filter(x=>x.status).map(x=>({field:'attendance',personId:x.personId,before:{status:x.status,notes:x.notes},after:{status:null,notes:x.notes}})));await db.query('UPDATE meeting_attendance SET status=NULL,"updatedAt"=now() WHERE "meetingId"=$1',[id]);}
    status='CANCELLED';
   }
   changes.push({field:'status',before:m.status,after:status});
   const saved=await r.touch(db,id,status,ctx.user.id,{...(input.action==='SAVE'?{notes}:{}),reason});
   await r.event(db,m,input.action==='SAVE'?(m.status==='RECORDED'?'EDIT':'SAVE'):input.action,ctx,changes,reason);return saved;
  });
 }
 async function list(q,ctx){const {from,to}=p.range(q),scope=p.access(ctx.user,'ver',q.cellId);if(q.cellId)p.uuid(q.cellId);const page=p.page(q),v=[scope.all,scope.ids,from,to,q.cellId||null];
  const filter='($1 OR m."cellId"=ANY($2::uuid[])) AND m.date BETWEEN $3 AND $4 AND ($5::uuid IS NULL OR m."cellId"=$5)';
  const totals=(await pool.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE status IN ('RECORDED','CLOSED'))::int AS recorded,count(*) FILTER(WHERE status='CANCELLED')::int AS cancelled,count(*) FILTER(WHERE status IN ('SCHEDULED','OPEN') AND (date+time::time)>(now() AT TIME ZONE 'America/Argentina/Buenos_Aires'))::int AS upcoming,count(*) FILTER(WHERE status IN ('SCHEDULED','OPEN') AND (date+time::time)<=(now() AT TIME ZONE 'America/Argentina/Buenos_Aires'))::int AS pending FROM cell_meetings m WHERE ${filter}`,v)).rows[0];
  const items=(await pool.query(`SELECT m.*,c."displayCode",a.expected,a.present FROM cell_meetings m JOIN cells c ON c.id=m."cellId" LEFT JOIN LATERAL (SELECT count(*)::int AS expected,count(*) FILTER(WHERE status='PRESENT')::int AS present FROM meeting_attendance WHERE "meetingId"=m.id) a ON true WHERE ${filter} ORDER BY m.date DESC,c."displayCode",m.id LIMIT 50 OFFSET $6`,[...v,(page-1)*50])).rows;
  const missing=Number((await pool.query(`SELECT count(*) AS n FROM cells c WHERE ($1 OR c.id=ANY($2::uuid[])) AND ($3::uuid IS NULL OR c.id=$3) AND c.status='ACTIVE' AND NOT EXISTS(SELECT 1 FROM cell_schedules s WHERE s."cellId"=c.id AND s.id=(SELECT id FROM cell_schedules WHERE "cellId"=c.id AND "effectiveWeek"<=$4 ORDER BY "effectiveWeek" DESC,sequence DESC LIMIT 1) AND s.day IS NOT NULL AND s.time IS NOT NULL)`,[scope.all,scope.ids,q.cellId||null,weekStart(to)])).rows[0].n);
  return {from,to,page,pages:Math.max(1,Math.ceil(totals.total/50)),totals,missingSchedule:missing,items:items.map(m=>({...m,temporal:temporalState(m)})),capabilities:p.caps(ctx.user,q.cellId)};
 }
 async function history(id,q,ctx){const m=await detail(id,ctx),page=p.page(q);const total=Number((await pool.query('SELECT count(*) AS n FROM meeting_events WHERE "meetingId"=$1',[m.id])).rows[0].n);return {page,pages:Math.max(1,Math.ceil(total/20)),items:(await pool.query('SELECT * FROM meeting_events WHERE "meetingId"=$1 ORDER BY sequence DESC LIMIT 20 OFFSET $2',[m.id,(page-1)*20])).rows};}
 async function person(id,q,ctx){p.uuid(id);assertPerson(requirePermission(ctx.user,'personas.ver'),id);const scope=p.access(ctx.user,'ver'),page=p.page(q);const filter=`a."personId"=$1 AND ($2 OR m."cellId"=ANY($3::uuid[]))`;const v=[id,scope.all,scope.ids];const total=Number((await pool.query(`SELECT count(*) AS n FROM meeting_attendance a JOIN cell_meetings m ON m.id=a."meetingId" WHERE ${filter}`,v)).rows[0].n);return {page,pages:Math.max(1,Math.ceil(total/20)),items:(await pool.query(`SELECT m.id,m.date,m.status AS "meetingStatus",m."cellId",c."displayCode",CASE WHEN m.status IN ('RECORDED','CLOSED') THEN a.status ELSE NULL END AS status,a.notes FROM meeting_attendance a JOIN cell_meetings m ON m.id=a."meetingId" JOIN cells c ON c.id=m."cellId" WHERE ${filter} ORDER BY m.date DESC,m.id LIMIT 20 OFFSET $4`,[...v,(page-1)*20])).rows};}
 async function matrix(cellId,q,ctx){p.uuid(cellId);p.access(ctx.user,'ver',cellId);const ps=requirePermission(ctx.user,'personas.ver'),{from,to}=p.range(q),page=p.page(q);
  const meetings=(await pool.query('SELECT * FROM cell_meetings WHERE "cellId"=$1 AND date BETWEEN $2 AND $3 ORDER BY date,id',[cellId,from,to])).rows;
  // Live temporal preview before opening; captured participants afterwards. Constant query count.
  const base=`WITH eligible AS (SELECT a."personId",m.id AS "meetingId",a.status FROM cell_meetings m JOIN meeting_attendance a ON a."meetingId"=m.id WHERE m.id=ANY($1::uuid[]) AND m."snapshotAt" IS NOT NULL UNION SELECT cm."personId",m.id,NULL FROM cell_meetings m JOIN cell_memberships cm ON cm."cellId"=m."cellId" AND cm."startDate"<=m.date AND (cm."endDate" IS NULL OR cm."endDate">m.date) WHERE m.id=ANY($1::uuid[]) AND m."snapshotAt" IS NULL),visible AS (SELECT * FROM eligible WHERE $2 OR "personId"=ANY($3::uuid[]))`;
  const v=[meetings.map(m=>m.id),ps.all,ps.ids];const total=Number((await pool.query(base+' SELECT count(DISTINCT "personId") AS n FROM visible',v)).rows[0].n);
  const rows=(await pool.query(base+` SELECT p.id,p.names,p."lastNames",jsonb_agg(jsonb_build_object('meetingId',v."meetingId",'status',v.status)) AS records FROM visible v JOIN people p ON p.id=v."personId" GROUP BY p.id ORDER BY p."sortName",p.id LIMIT 50 OFFSET $4`,[...v,(page-1)*50])).rows;
  return {meetings,items:rows,page,pages:Math.max(1,Math.ceil(total/50)),total};
 }
 return {generate,detail,action,list,history,person,matrix};
}
