import {DomainError} from '../core/errors.mjs';
import {validCalendarDate,outingStates} from '../../src/domain/evangelism.js';
import {installationToday} from '../core/calendar.mjs';
import {treeSQL} from './organization.mjs';
import {evangelismAccess} from './evangelism-policy.mjs';
import {scopeFor} from '../identity/authorization.mjs';
import {territoryAccess} from './policy.mjs';
const fail=()=>{throw new DomainError(422,'Revisá las fechas y filtros de actividades (máximo un año por período).');};
const day=date=>Math.round(Date.parse(date+'T12:00:00Z')/86400000);
export function outingQuery(q,{comparison=false}={}){
 const keys=['from','to','responsibleId','zone','sector','status','page',...(comparison?['compareFrom','compareTo']:[])];
 if(Object.entries(q).some(([k,v])=>!keys.includes(k)||typeof v!=='string'||v.length>100))fail();
 const today=installationToday(),from=q.from||today.slice(0,7)+'-01',to=q.to||new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7)),0)).toISOString().slice(0,10);
 if(!validCalendarDate(from)||!validCalendarDate(to)||day(to)<day(from)||day(to)-day(from)>365)fail();
 if(q.status&&!Object.hasOwn(outingStates,q.status)||q.page&&(!/^\d{1,6}$/.test(q.page)||Number(q.page)<1))fail();
 const values=[from,to],where=['o.date BETWEEN $1::date AND $2::date'],bind=v=>{values.push(v);return '$'+values.length;};
 for(const name of ['responsibleId','zone','sector'])if(q[name]&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(q[name]))fail();
 if(q.responsibleId)where.push('o.responsible_id='+bind(q.responsibleId));
 for(const key of ['zone','sector'])if(q[key])where.push(`${bind(q[key])}::uuid=ANY(t.path)`);
 if(q.status)where.push('o.status='+bind(q.status));
 if(comparison&&(q.compareFrom||q.compareTo)&&(!validCalendarDate(q.compareFrom)||!validCalendarDate(q.compareTo)||day(q.compareTo)<day(q.compareFrom)||day(q.compareTo)-day(q.compareFrom)>365))fail();
 return {from,to,where:where.join(' AND '),values,bind,page:Number(q.page)||1};
}
export async function listOutings(db,q,user,{routes=false}={}){
 evangelismAccess(user);const filter=outingQuery(q),{values,bind}=filter;
 if(routes){const rows=(await db.query(`${treeSQL} SELECT o.id,o.title,o.date,o.status,r.geometry,r.length_meters FROM evangelism_outings o JOIN tree t ON t.id=o.unit_id JOIN evangelism_routes r ON r.outing_id=o.id WHERE ${filter.where} ORDER BY o.date DESC,o.id LIMIT 51`,values)).rows;return {items:rows.slice(0,50).map(r=>({id:r.id,title:r.title,date:r.date,status:r.status,geometry:r.geometry,lengthMeters:r.length_meters,source:'MANUAL'})),more:rows.length>50};}
 const total=Number((await db.query(`${treeSQL} SELECT count(*) n FROM evangelism_outings o JOIN tree t ON t.id=o.unit_id WHERE ${filter.where}`,values)).rows[0].n),pages=Math.max(1,Math.ceil(total/20)),page=Math.min(filter.page,pages);
 const items=(await db.query(`${treeSQL} SELECT o.id,o.title,o.date,o.start_time,o.end_time,o.responsible_id,o.unit_id,o.status,o.participant_count,o.version,t.label territory_label,coalesce(nullif(concat_ws(' ',p.names,p."lastNames"),''),u.username) responsible_name,(r.outing_id IS NOT NULL) has_route FROM evangelism_outings o JOIN tree t ON t.id=o.unit_id JOIN users u ON u.id=o.responsible_id LEFT JOIN people p ON p.id=u.person_id LEFT JOIN evangelism_routes r ON r.outing_id=o.id WHERE ${filter.where} ORDER BY o.date DESC,o.start_time DESC,o.id LIMIT ${bind(20)} OFFSET ${bind((page-1)*20)}`,values)).rows.map(r=>({id:r.id,title:r.title,date:r.date,startTime:r.start_time.slice(0,5),responsibleName:r.responsible_name,territoryLabel:r.territory_label,status:r.status,participantCount:r.participant_count,hasRoute:r.has_route}));return {items,total,page,pages,from:filter.from,to:filter.to};
}
export async function evangelismStatistics(db,q,user){
 evangelismAccess(user,'estadisticas');const filter=outingQuery(q,{comparison:true}),values=[...filter.values],bind=v=>{values.push(v);return '$'+values.length;};
 const {compareFrom,compareTo,...otherFilters}=q;
 const period=values[0]+' / '+values[1],comparison=compareFrom?outingQuery({...otherFilters,from:compareFrom,to:compareTo}):null;
 // Build the comparison from the same non-date filters; no per-month or per-sector requests.
 const cValues=comparison?.values.slice(2)||[],dateFrom=comparison?bind(comparison.from):null,dateTo=comparison?bind(comparison.to):null;
 let comparisonWhere='FALSE';if(comparison){let ix=0;comparisonWhere=comparison.where.replace(/\$(\d+)/g,(_,n)=>Number(n)===1?dateFrom:Number(n)===2?dateTo:bind(cValues[ix++]));}
 const cellScope=scopeFor(user,'celulas.ver'),cellRead=territoryAccess(user)||territoryAccess(user,'territorio-analisis'),cellAll=bind(cellRead&&cellScope.all),cellIds=bind(cellRead?cellScope.ids:[]);
 const data=(await db.query(`${treeSQL}, current AS (SELECT o.* FROM evangelism_outings o JOIN tree t ON t.id=o.unit_id WHERE ${filter.where}), compared AS (SELECT o.* FROM evangelism_outings o JOIN tree t ON t.id=o.unit_id WHERE ${comparisonWhere}), all_periods AS (SELECT 'current' period,* FROM current UNION ALL SELECT 'previous',* FROM compared), totals AS (
 SELECT period,count(*)::int activities,count(*) FILTER(WHERE status='COMPLETED')::int completed,count(*) FILTER(WHERE status='PLANNED')::int planned,count(*) FILTER(WHERE status='IN_PROGRESS')::int in_progress,count(*) FILTER(WHERE status='CANCELLED')::int cancelled,coalesce(sum(participant_count) FILTER(WHERE status='COMPLETED'),0)::int participations,count(*) FILTER(WHERE status='COMPLETED' AND participant_count IS NULL)::int unknown_participation FROM all_periods GROUP BY period
 ), monthly AS (SELECT to_char(date,'YYYY-MM') AS "month",count(*)::int activities,count(*) FILTER(WHERE status='COMPLETED')::int completed FROM current GROUP BY to_char(date,'YYYY-MM')), visits AS (SELECT unit_id,count(*)::int visits,max(date) last_visit FROM current WHERE status='COMPLETED' GROUP BY unit_id), sectors AS (
 SELECT t.id,t.label,t.survey_status,coalesce(v.visits,0) visits,v.last_visit FROM tree t LEFT JOIN visits v ON v.unit_id=t.id WHERE t.level='SECTOR' AND t.active ${q.zone?'AND '+bind(q.zone)+'::uuid=ANY(t.path)':''} ${q.sector?'AND t.id='+bind(q.sector):''}
 ), cell_counts AS (SELECT ct.unit_id,count(*)::int n FROM cell_territory ct JOIN cells c ON c.id=ct.cell_id WHERE c.status='ACTIVE' AND (${cellAll} OR c.id=ANY(${cellIds}::uuid[])) GROUP BY ct.unit_id)
 SELECT coalesce((SELECT jsonb_object_agg(period,to_jsonb(totals)-'period') FROM totals),'{}') totals,coalesce((SELECT jsonb_agg(monthly ORDER BY "month") FROM monthly),'[]') monthly,
 (SELECT count(*)::int FROM sectors WHERE visits>0) visited_sectors,(SELECT count(*)::int FROM sectors WHERE visits=0) sectors_without_visits,
 coalesce((SELECT jsonb_agg(p ORDER BY visits,label) FROM (SELECT s.*,${cellRead?'coalesce(c.n,0)':'NULL::integer'} cell_count FROM sectors s LEFT JOIN cell_counts c ON c.unit_id=s.id ORDER BY s.visits,s.label LIMIT 500) p),'[]') sectors,
 coalesce((SELECT jsonb_agg(a ORDER BY date,id) FROM (SELECT id,title,date,participant_count FROM current ORDER BY date,id LIMIT 500) a),'[]') participation_by_activity`,values)).rows[0];
 const empty={activities:0,completed:0,planned:0,in_progress:0,cancelled:0,participations:0,unknown_participation:0};return {...data,totals:{current:{...empty,...data.totals.current},previous:comparison?{...empty,...data.totals.previous}:null},period,comparison:comparison?[comparison.from,comparison.to]:null};
}
