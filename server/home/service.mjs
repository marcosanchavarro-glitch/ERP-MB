import {DomainError} from '../core/errors.mjs';
import {scopeFor} from '../identity/authorization.mjs';
import {publicUser} from '../identity/presentation.mjs';
import {departmentScope} from '../departments/policy.mjs';
import {createDashboardService} from '../office/dashboard.mjs';
import {officeDashboardAccess} from '../office/dashboard-policy.mjs';
import {createLeaderService} from '../leader/service.mjs';
import {calendarToday} from '../../src/domain/calendar.js';
import {installationTimezone} from '../core/calendar.mjs';
import {log} from '../core/logger.mjs';

const has=s=>s.all||s.ids.length>0;
const destinations=new Set(['/oficina/dashboard','/oficina/trabajo','/oficina/personas','/oficina/celulas','/oficina/asistencia','/oficina/seguimiento','/oficina/nuevos','/oficina/citas','/oficina/cumpleanos','/oficina/calidad','/recepcion','/territorio/mapa','/territorio/analisis','/territorio/evangelismo','/departamentos','/administracion/usuarios','/oficina/areas']);
export function createHomeService(pool,{timezone=installationTimezone(),now=()=>new Date()}={}){
 const office=createDashboardService(pool,{timezone,now}),leader=createLeaderService(pool);
 return async function home(query,user,{requestId}={}){
  if(!user)throw new DomainError(401,'Iniciá sesión para continuar.');
  if(Object.keys(query).some(k=>k!=='source')||query.source&&!['indicators','office','departments','leader'].includes(query.source))throw new DomainError(422,'Consulta de Inicio no válida.');
  const instant=now(),today=calendarToday(timezone,instant),localTime=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(instant),tasks={};
  const people=scopeFor(user,'personas.ver'),cells=scopeFor(user,'celulas.ver'),departments=departmentScope(user);
  if(has(people)||has(cells))tasks.indicators=async()=>{
   const parts=[],values=[],bind=v=>{values.push(v);return '$'+values.length;};
   for(const [key,label,table,scope,path,extra]of [['people','Personas registradas','people',people,'/oficina/personas',''],['cells','Células activas','cells',cells,'/oficina/celulas'," AND status='ACTIVE'"]])if(has(scope))parts.push(`jsonb_build_object('id','${key}','label','${label}','path','${path}','count',(SELECT count(*) FROM ${table} WHERE (${scope.all?'TRUE':`id=ANY(${bind(scope.ids)}::uuid[])`})${extra}))`);
   return {items:(await pool.query('SELECT jsonb_build_array('+parts.join(',')+') items',values)).rows[0].items};
  };
  if(officeDashboardAccess(user))tasks.office=async()=>office({},user);
  if(has(departments))tasks.departments=async()=>{
   // Exact organizational scope; no participant names, notes, audit payload or implicit hierarchy.
   return (await pool.query(`WITH units AS (SELECT id,name FROM organizational_units WHERE active AND ($1 OR id=ANY($2::uuid[]))), upcoming AS (SELECT a.id,a.unit_id,a.title,a.activity_date AS date,a.start_time AS time,a.status,u.name AS department FROM departmental_activities a JOIN units u ON u.id=a.unit_id WHERE a.status IN('SCHEDULED','IN_PROGRESS') AND a.activity_date||'T'||a.start_time >= $3)
    SELECT (SELECT count(*)::int FROM units) count,(SELECT count(*)::int FROM upcoming) "upcomingCount",
    coalesce((SELECT jsonb_agg(x) FROM (SELECT * FROM upcoming ORDER BY date,time,id LIMIT 6) x),'[]') upcoming,
    coalesce((SELECT jsonb_agg(x) FROM (SELECT id,name FROM units ORDER BY lower(name),id LIMIT 6) x),'[]') units,
    coalesce((SELECT jsonb_agg(x) FROM (SELECT e.sequence AS id,e.occurred_at AS at,e.action,a.id AS "activityId",u.id AS "unitId",u.name AS department FROM departmental_activity_events e JOIN departmental_activities a ON a.id=e.activity_id JOIN units u ON u.id=a.unit_id ORDER BY e.occurred_at DESC,e.sequence DESC LIMIT 6) x),'[]') recent`,[departments.all,departments.ids,today+'T'+localTime])).rows[0];
  };
  if(user.grants.some(g=>g.permission==='lider.portal'&&g.scope_type==='global'))tasks.leader=async()=>{
   // Reuse the portal's live authorization before a single set-based summary; never generate meetings here.
   const entry=await leader.entry({user,requestId}),ids=entry.cells.map(c=>c.id);
   if(!ids.length)return {items:[]};
   const items=(await pool.query(`SELECT c.id,c."displayCode",(SELECT count(*)::int FROM cell_memberships m WHERE m."cellId"=c.id AND m."endDate" IS NULL) members,
    (SELECT jsonb_build_object('id',m.id,'date',m.date,'time',m.time,'status',m.status) FROM cell_meetings m WHERE m."cellId"=c.id AND m.status IN('SCHEDULED','OPEN') AND m.date+m.time::time>=($2::timestamp) ORDER BY m.date,m.time,m.id LIMIT 1) next
    FROM cells c WHERE c.id=ANY($1::uuid[]) ORDER BY c."displayCode",c.id LIMIT 6`,[ids,today+'T'+localTime])).rows;
   return {items};
  };
  const keys=Object.keys(tasks).filter(key=>!query.source||key===query.source),results=await Promise.allSettled(keys.map(key=>tasks[key]())),sources={};
  results.forEach((result,i)=>{const key=keys[i];if(result.status==='fulfilled')sources[key]={status:'ok',data:result.value};else{log('error','home_source_error',{requestId,entity:key,code:result.reason?.code||'SOURCE_UNAVAILABLE'});sources[key]={status:'error',message:'No pudimos actualizar este resumen.',requestId};}});
  const access=publicUser(user).access;
  return {today,timezone,generatedAt:instant.toISOString(),sources,quick:[...destinations].map(path=>access.paths.find(p=>p.path===path)).filter(Boolean).slice(0,7),personal:[...(access.leaderPortal?[{label:'Mi Célula',path:'/mi-celula'}]:[]),...(access.officeWork?.['contactos.ver']?[{label:'Mi trabajo de Oficina',path:'/oficina/trabajo'}]:[])]};
 };
}
