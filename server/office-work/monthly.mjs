import {access,caps,clock,filters,monthRange,grantSql,results} from './policy.mjs';
import {workQuery,publicRow} from './query.mjs';
import {shape,fail} from '../meetings/policy.mjs';
import {scopeFor} from '../identity/authorization.mjs';
export function createMonthlyService(pool,options={}){
 async function monthly(query,ctx){access(ctx);const c=clock(options),q=filters(query,ctx,c.today),s=workQuery(ctx.user,q,c),where=s.where;
 const totals=(await pool.query(s.sql+` SELECT count(*)::int total,count(*) FILTER(WHERE covered)::int covered,count(*) FILTER(WHERE NOT covered)::int pending,count(*) FILTER(WHERE next_eligible_at IS NOT NULL AND needs_contact)::int retries,count(*) FILTER(WHERE sex IS NULL)::int missing_sex,count(*) FILTER(WHERE nullif("phoneKey",'') IS NULL OR wrong_phone)::int missing_phone,coalesce(sum(present),0)::int present,coalesce(sum(absent),0)::int absent,coalesce(sum(pending_meetings),0)::int pending_meetings,coalesce(sum(attempts),0)::int attempts,coalesce(sum(effective),0)::int effective FROM work_rows${where}`,s.values)).rows[0];
 const items=(await pool.query(s.sql+` SELECT * FROM work_rows${where} ORDER BY "sortName",id LIMIT 50 OFFSET ${s.bind((q.page-1)*50)}`,s.values)).rows.map(publicRow);
 // Chart data is aggregated in SQL; no complete Person/notes dataset is downloaded.
 const chartsQuery=workQuery(ctx.user,q,c),v=chartsQuery;
 const charts=(await pool.query(v.sql+`, selected AS (SELECT * FROM work_rows${v.where}), contact_rows AS (SELECT co.* FROM office_contacts co JOIN selected p ON p.id=co.person_id WHERE (co.occurred_at AT TIME ZONE ${v.zone})::date BETWEEN ${v.from}::date AND ${v.to}::date),
 daily AS (SELECT (occurred_at AT TIME ZONE ${v.zone})::date AS "day",count(*)::int attempts,count(*) FILTER(WHERE result='CONTACTO_ESTABLECIDO')::int effective FROM contact_rows GROUP BY 1),
 evolution AS (SELECT date_trunc('week',a.date)::date AS "week",count(*) FILTER(WHERE a.state='PRESENT')::int present,count(*) FILTER(WHERE a.state='ABSENT')::int absent,count(*) FILTER(WHERE a.state='PENDING')::int pending FROM participation a JOIN selected p ON p.id=a.person_id GROUP BY 1),
 cells_attendance AS (SELECT a.cell_id,c."displayCode" code,count(*) FILTER(WHERE a.state='PRESENT')::int present,count(*) FILTER(WHERE a.state='ABSENT')::int absent,count(*) FILTER(WHERE a.state='PENDING')::int pending,count(DISTINCT a.meeting_id)::int meetings FROM participation a JOIN selected p ON p.id=a.person_id JOIN cells c ON c.id=a.cell_id GROUP BY a.cell_id,c."displayCode"),
 cell_coverage AS (SELECT cell_id,count(*)::int people,count(*) FILTER(WHERE covered)::int covered,count(*) FILTER(WHERE NOT covered)::int pending FROM selected WHERE cell_id IS NOT NULL GROUP BY cell_id)
 SELECT jsonb_build_object('daily',coalesce((SELECT jsonb_agg(d ORDER BY day) FROM daily d),'[]'),'evolution',coalesce((SELECT jsonb_agg(e ORDER BY week) FROM evolution e),'[]'),
 'results',coalesce((SELECT jsonb_object_agg(result,n) FROM (SELECT result,count(*)::int n FROM contact_rows GROUP BY result) r),'{}'),
 'cells',coalesce((SELECT jsonb_agg(x ORDER BY code) FROM (SELECT ca.*,coalesce(cc.people,0) people,coalesce(cc.covered,0) covered,coalesce(cc.pending,0) uncovered FROM cells_attendance ca LEFT JOIN cell_coverage cc ON cc.cell_id=ca.cell_id UNION ALL SELECT cc.cell_id,c."displayCode",0,0,0,0,cc.people,cc.covered,cc.pending FROM cell_coverage cc JOIN cells c ON c.id=cc.cell_id WHERE NOT EXISTS(SELECT 1 FROM cells_attendance ca WHERE ca.cell_id=cc.cell_id)) x),'[]')) data`,v.values)).rows[0].data;
 const cs=scopeFor(ctx.user,'celulas.ver');const choices=(await pool.query('SELECT id,"displayCode" code FROM cells WHERE ($1 OR id=ANY($2::uuid[])) ORDER BY "displayCode",id LIMIT 500',[cs.all,cs.ids])).rows;
 const workers=caps(ctx.user).panorama?(await pool.query(`SELECT u.id,coalesce(p.names,u.username) name,p."lastNames" FROM office_worker_settings w JOIN users u ON u.id=w.user_id LEFT JOIN people p ON p.id=u.person_id WHERE w.active AND u.active ORDER BY coalesce(p."sortName",u.username),u.id`)).rows:[];
 return {month:q.month,from:q.from,to:q.to,today:c.today,timezone:c.timezone,page:q.page,pages:Math.max(1,Math.ceil(totals.total/50)),total:totals.total,items,totals,charts,cells:choices,workers,results,capabilities:caps(ctx.user),coverageRule:'Una Persona activa queda cubierta en el mes al registrar al menos un CONTACTO_ESTABLECIDO. Intentos y cancelaciones no suman cobertura.'};
 }
 async function overview(query,ctx){access(ctx,'panorama');shape(query,['month']);const c=clock(options),q=filters({month:query.month},ctx,c.today),base=await monthly({month:q.month},ctx);const ps=scopeFor(ctx.user,'personas.ver');const workers=(await pool.query(`SELECT u.id,coalesce(p.names,u.username) name,p."lastNames",w.active,w.sexes,w.daily_goal,
 count(co.id) FILTER(WHERE (co.occurred_at AT TIME ZONE $2)::date=$3::date)::int today_attempts,count(co.id) FILTER(WHERE co.result='CONTACTO_ESTABLECIDO' AND (co.occurred_at AT TIME ZONE $2)::date=$3::date)::int today_effective,
 count(co.id)::int month_attempts,count(co.id) FILTER(WHERE co.result='CONTACTO_ESTABLECIDO')::int month_effective
 FROM office_worker_settings w JOIN users u ON u.id=w.user_id LEFT JOIN people p ON p.id=u.person_id LEFT JOIN office_contacts co ON co.worker_id=u.id AND (co.occurred_at AT TIME ZONE $2)::date BETWEEN $4::date AND $5::date AND ($6 OR co.person_id=ANY($7::uuid[]))
 WHERE u.active AND $1::uuid IS NOT NULL GROUP BY u.id,p.names,p."lastNames",p."sortName",w.user_id ORDER BY coalesce(p."sortName",u.username),u.id`,[ctx.user.id,c.timezone,c.today,q.from,q.to,ps.all,ps.ids])).rows;return {...base,workers};}
 return {monthly,overview};
}
