import {scopeFor} from '../identity/authorization.mjs';
import {DomainError} from '../core/errors.mjs';
import {calendarToday,calendarAdd,validTimezone} from '../../src/domain/calendar.js';
import {birthdayInYear,birthdayRange} from '../../src/domain/birthday.js';
import {completenessFields} from '../../src/domain/person.js';
import {weekStart} from '../../src/domain/meeting.js';
import {installationTimezone} from '../core/calendar.mjs';
import {newcomerStateSql} from '../newcomers/state.mjs';
import {officeDashboardAccess,intersectScopes} from './dashboard-policy.mjs';

export function createDashboardService(pool,{timezone=installationTimezone(),now=()=>new Date()}={}){
 validTimezone(timezone);
 return async function dashboard(query,user){
  if(!user)throw new DomainError(401,'Iniciá sesión para continuar.');
  if(!officeDashboardAccess(user))throw new DomainError(403,'No tenés acceso operativo a Oficina.');
  if(Object.keys(query).length)throw new DomainError(422,'El Dashboard no admite filtros de alcance.');
  const instant=now(),today=calendarToday(timezone,instant),week=weekStart(today),values=[],parts=[],events=[],widgets=[],actions=[];
  const bind=v=>{values.push(v);return '$'+values.length;};
  const scope=(...keys)=>intersectScopes(...keys.map(p=>scopeFor(user,p))),has=s=>s.all||s.ids.length>0;
  const where=(s,column)=>s.all?'TRUE':`${column}=ANY(${bind(s.ids)}::uuid[])`;
  const add=(key,sql,build)=>{parts.push(`'${key}',(${sql})`);widgets.push({key,build});};
  const metric=(label,count,path)=>({label,count,path});
  const activity=(sql)=>events.push(`(${sql} ORDER BY at DESC,id DESC LIMIT 8)`);
  const day=bind(today);

  const attendance=scope('asistencia.ver');
  if(has(attendance)){
   const w=where(attendance,'m."cellId"'),start=bind(week),time=bind(instant.toISOString());
   add('attendance',`SELECT jsonb_build_object('current',count(DISTINCT m."cellId") FILTER(WHERE m.date>=${start}::date),'older',count(DISTINCT m."cellId") FILTER(WHERE m.date<${start}::date),'oldest',min(m.date) FILTER(WHERE m.date<${start}::date)) FROM cell_meetings m WHERE ${w} AND m.status IN ('SCHEDULED','OPEN') AND (m.date+m.time::time)<=(${time}::timestamptz AT TIME ZONE 'America/Argentina/Buenos_Aires')`,d=>({id:'attendance',title:'Asistencia',note:'Células con reuniones existentes sin cargar. Se excluyen futuras y canceladas.',items:[metric('Pendientes esta semana',d.current,'/oficina/asistencia?week='+week),metric('Pendientes de semanas anteriores',d.older,'/oficina/asistencia?week='+(d.oldest?weekStart(d.oldest):week))]}));
   activity(`SELECT e.id,e."occurredAt" at,'Asistencia actualizada' label,'/oficina/asistencia?week='||m.week::text path FROM meeting_events e JOIN cell_meetings m ON m.id=e."meetingId" WHERE ${w} AND e.action<>'GENERATE'`);
  }
  const followup=scope('seguimiento.ver');
  if(has(followup)){
   add('followup',`SELECT jsonb_build_object('open',count(*),'urgent',count(*) FILTER(WHERE c.level='URGENT')) FROM followup_cases c WHERE ${where(followup,'c.person_id')} AND c.status IN ('OPEN','FOLLOWING')`,d=>({id:'followup',title:'Seguimiento',note:'Casos abiertos o en seguimiento; prioridad registrada por el módulo.',items:[metric('Casos abiertos',d.open,'/oficina/seguimiento?caseStatus=active'),metric('Casos urgentes abiertos',d.urgent,'/oficina/seguimiento?caseStatus=active&caseLevel=URGENT')]}));
   activity(`SELECT e.id,e.occurred_at at,CASE WHEN e.action='CONTACT' THEN 'Contacto de seguimiento registrado' WHEN e.action='CLOSE' THEN 'Caso cerrado' WHEN e.action='CASE_OPEN' THEN 'Caso abierto' ELSE 'Seguimiento actualizado' END label,'/oficina/seguimiento/personas/'||e.person_id::text path FROM followup_events e WHERE ${where(followup,'e.person_id')}`);
  }
  if(scope('nuevos.ver').all){
   add('newcomers',`SELECT jsonb_build_object('pending',count(*) FILTER(WHERE state='PENDIENTE_CONTACTO'),'integration',count(*) FILTER(WHERE state='EN_INTEGRACION'),'ready',count(*) FILTER(WHERE state='LISTO_PARA_ALTA')) FROM (SELECT ${newcomerStateSql} state FROM newcomer_progress) n`,d=>({id:'newcomers',title:'Nuevos',note:'El alta como miembro sigue requiriendo confirmación manual.',items:[metric('Pendientes de contacto',d.pending,'/oficina/nuevos?state=PENDIENTE_CONTACTO'),metric('En integración',d.integration,'/oficina/nuevos?state=EN_INTEGRACION'),metric('Listos para alta',d.ready,'/oficina/nuevos?state=LISTO_PARA_ALTA')]}));
   activity(`SELECT e.id,e.occurred_at at,CASE WHEN e.action='CREATE' THEN 'Nuevo registrado' WHEN e.action='CONVERT' THEN 'Alta como miembro confirmada' WHEN e.action='REFER' THEN 'Nuevo derivado a célula' WHEN e.action='CONTACT' THEN 'Contacto de Nuevo registrado' ELSE 'Integración actualizada' END label,'/oficina/nuevos/'||e.newcomer_id::text path FROM newcomer_events e WHERE e.newcomer_id IS NOT NULL`);
  }
  const birthdays=scope('personas.ver','personas.cumpleanos');
  if(has(birthdays)){
   // Match only the seven relevant month/day keys. Feb 29 uses the existing calendar helper.
   const [,end]=birthdayRange('next7',today),dates=[];
   for(let date=today;date<=end;date=calendarAdd(date,1)){dates.push({md:date.slice(5),date});if(date.slice(5)==='02-28'&&birthdayInYear('2000-02-29',Number(date.slice(0,4)))===date)dates.push({md:'02-29',date});}
   add('birthdays',`SELECT jsonb_build_object('today',count(*) FILTER(WHERE d.date=${day}),'upcoming',count(*) FILTER(WHERE d.date<>${day})) FROM people p JOIN jsonb_to_recordset(${bind(JSON.stringify(dates))}::jsonb) AS d(md text,date text) ON to_char(p."birthDate",'MM-DD')=d.md WHERE ${where(birthdays,'p.id')} AND p.status='ACTIVA' AND p."birthDate" BETWEEN '1800-01-01'::date AND ${day}::date`,d=>({id:'birthdays',title:'Cumpleaños',note:'Personas activas. Próximos seis días, además de hoy.',items:[metric('Cumplen hoy',d.today,'/oficina/cumpleanos?view=today'),metric('En los próximos seis días',d.upcoming,'/oficina/cumpleanos?view=next7')]}));
  }
  const quality=scope('personas.ver','personas.calidad'),cellQuality=scope('celulas.ver','celulas.calidad');
  if(has(quality)){
   const missing=completenessFields.map(k=>`coalesce(p."${k}"::text,'')=''`).join(' OR ');
   add('peopleQuality',`WITH permitted AS (SELECT p.*,count(*) OVER(PARTITION BY "documentKey") nd,count(*) OVER(PARTITION BY "phoneKey") np,count(*) OVER(PARTITION BY "nameKey") nn FROM people p WHERE ${where(quality,'p.id')}) SELECT jsonb_build_object('incomplete',count(*) FILTER(WHERE ${missing}),'duplicates',count(*) FILTER(WHERE (p."documentKey" IS NOT NULL AND nd>1) OR (p."phoneKey"<>'' AND np>1) OR (p."nameKey"<>'' AND nn>1))) FROM permitted p WHERE p.status='ACTIVA'`,d=>({id:'peopleQuality',title:'Calidad de Personas',note:'Campos de completitud y coincidencias existentes; no implica fusionar registros.',items:[metric('Fichas activas incompletas',d.incomplete,'/oficina/calidad?tab=people&completeness=incomplete'),metric('Fichas activas con posibles duplicados',d.duplicates,'/oficina/calidad?tab=people&problem=duplicates')]}));
  }
  if(has(cellQuality))add('cellQuality',`SELECT jsonb_build_object('noLeader',count(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM cell_memberships cm WHERE cm."cellId"=c.id AND cm."endDate" IS NULL AND cm."startDate"<=${day}::date AND cm.role='LEADER'))) FROM cells c WHERE ${where(cellQuality,'c.id')} AND c.status='ACTIVE'`,d=>({id:'cellQuality',title:'Calidad de Células',note:'Responsables vigentes según las membresías existentes.',items:[metric('Células activas sin líder',d.noLeader,'/oficina/calidad?tab=cells&problem=missing_leader')]}));

  const history=scope('personas.ver','personas.historial'),cells=scope('celulas.ver');
  if(has(history))activity(`SELECT e.id,e."occurredAt" at,CASE WHEN e.type='person.created' THEN 'Persona registrada' WHEN e.type='person.integrated' THEN 'Ingreso a Matriz confirmado' ELSE 'Ficha de Persona actualizada' END label,'/oficina/personas/'||e."personId"::text path FROM person_events e WHERE ${where(history,'e."personId"')}`);
  if(has(cells))activity(`SELECT e.id,e."occurredAt" at,'Célula actualizada' label,'/oficina/celulas/'||e."cellId"::text path FROM cell_events e WHERE ${where(cells,'e."cellId"')}`);
  if(events.length)parts.push(`'activity',(SELECT coalesce(jsonb_agg(e ORDER BY at DESC,id DESC),'[]'::jsonb) FROM (SELECT * FROM (${events.join(' UNION ALL ')}) sources ORDER BY at DESC,id DESC LIMIT 8) e)`);
  if(scope('personas.crear').all&&scope('personas.ver').all)actions.push({label:'Nueva Persona',path:'/oficina/personas/nueva'});
  if(scope('celulas.crear').all&&cells.all)actions.push({label:'Nueva Célula',path:'/oficina/celulas/nueva'});
  if(scope('nuevos.registrar').all)actions.push({label:'Registrar Nuevo',path:'/recepcion'});
  if(has(attendance))actions.push({label:'Ver asistencia',path:'/oficina/asistencia?week='+week});
  // One bounded response / one DB round trip. No unapproved source is included in the SQL.
  // Additional modules (e.g. Citas) register a permitted summary + links in the same widget contract.
  let result={};if(parts.length)result=(await pool.query(`SELECT jsonb_build_object(${parts.join(',')}) data WHERE ${day}::date IS NOT NULL`,values)).rows[0].data;
  return {today,timezone,generatedAt:instant.toISOString(),widgets:widgets.map(w=>w.build(result[w.key])),activity:result.activity||[],actions};
 };
}
