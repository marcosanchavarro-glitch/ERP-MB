import {createDashboardService} from './dashboard.mjs';
import {fields,normalizeText} from '../../src/domain/person.js';
import {birthdayInfo,birthdayRange,birthdayInRange,birthdayViews} from '../../src/domain/birthday.js';
import {calendarToday,validTimezone} from '../../src/domain/calendar.js';
import {installationTimezone} from '../core/calendar.mjs';
import {requirePermission,scopeFor} from '../identity/authorization.mjs';
import {DomainError} from '../core/errors.mjs';
import {personQuality,cellQuality,problemLabels} from './quality.mjs';
const fail=()=>{throw new DomainError(422,'Revisá los filtros seleccionados.');};
export function officeQuery(q,kind){
 const allowed=kind==='birthdays'?['q','status','cellId','sex','minAge','maxAge','month','view','page']:['q','status','cellId','completeness','problem','page'];
 if(Object.entries(q).some(([k,v])=>!allowed.includes(k)||typeof v!=='string'||v.length>150))fail();
 for(const [key,values]of Object.entries({status:kind==='cells'?['ACTIVE','CLOSED']:['ACTIVA','INACTIVA'],sex:['HOMBRE','MUJER'],completeness:['complete','incomplete'],view:Object.keys(birthdayViews),problem:['all','incomplete','complete','review','duplicates',...Object.keys(problemLabels)]}))if(q[key]&&!values.includes(q[key]))fail();
 const number=(key,min,max)=>{if(q[key]&&!/^\d+$/.test(q[key]))fail();const value=q[key]?Number(q[key]):null;if(value!==null&&(value<min||value>max))fail();return value;};
 const minAge=number('minAge',0,250),maxAge=number('maxAge',0,250);if(minAge!==null&&maxAge!==null&&minAge>maxAge)fail();number('month',1,12);
 if(q.cellId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q.cellId))fail();
 return {...q,page:number('page',1,10000)||1,minAge,maxAge,status:q.status===undefined?(kind==='cells'?'ACTIVE':'ACTIVA'):q.status,view:q.view||'today',problem:q.problem||'all'};
}
function intersect(a,b){if(a.all)return b;if(b.all)return a;return {all:false,ids:a.ids.filter(id=>b.ids.includes(id))};}
// Cursor batches keep raw records on the server, in a consistent read-only snapshot.
// Only the requested page and aggregate counts leave this service.
async function scan(pool,sql,values,visit){const db=await pool.connect();try{
 await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 await db.query('DECLARE office_rows NO SCROLL CURSOR FOR '+sql,values);
 while(true){const {rows}=await db.query('FETCH FORWARD 200 FROM office_rows');if(!rows.length)break;for(const row of rows)visit(row);}
 await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}
const matchesProblem=(item,filter)=>filter==='all'||filter==='complete'&&item.completeness.complete||filter==='incomplete'&&!item.completeness.complete||filter==='review'&&item.problems.some(p=>p.severity!=='recommended')||filter==='duplicates'&&item.problems.some(p=>p.code.startsWith('duplicate_'))||item.problems.some(p=>p.code===filter);
export function createOfficeService(pool,{timezone=installationTimezone(),now=()=>new Date()}={}){
 validTimezone(timezone);
 async function list(kind,query,user){
  const q=officeQuery(query,kind),isCell=kind==='cells',birthday=kind==='birthdays';
  const scope=intersect(requirePermission(user,isCell?'celulas.calidad':birthday?'personas.cumpleanos':'personas.calidad'),requirePermission(user,isCell?'celulas.ver':'personas.ver'));
  const cellScope=scopeFor(user,'celulas.ver'),canAdmin=scopeFor(user,'admin.usuarios.ver').all;
  const today=calendarToday(timezone,now()),range=birthdayRange(q.view,today),values=[];
  const bind=x=>{values.push(x);return '$'+values.length;};
  const scoped=scope.all?'TRUE':`p.id=ANY(${bind(scope.ids)}::uuid[])`;
  const visibleCells=isCell||cellScope.all?'TRUE':`c.id=ANY(${bind(cellScope.ids)}::uuid[])`;
  const day=bind(today),conditions=[];
  if(q.status)conditions.push(`p.status=${bind(q.status)}`);
  if(q.sex)conditions.push(`p.sex=${bind(q.sex)}`);
  if(q.q){const text=bind('%'+normalizeText(q.q).replace(/[\\%_]/g,'\\$&')+'%');conditions.push(isCell?`lower(p."displayCode") LIKE ${text}`:`p."sortName" LIKE ${text}`);}
  if(q.cellId)conditions.push(isCell?`p.id=${bind(q.cellId)}::uuid`:`EXISTS(SELECT 1 FROM cell_memberships m JOIN cells c ON c.id=m."cellId" WHERE m."personId"=p.id AND m."endDate" IS NULL AND m."startDate"<=${day}::date AND c.status='ACTIVE' AND (${visibleCells}) AND c.id=${bind(q.cellId)}::uuid)`);
  const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
  let sql;
  if(isCell)sql=`SELECT p.id,p."displayCode",p.status,p."openedDate",p."meetingDay",p."meetingTime",p.address,p.locality,(SELECT count(*) FROM cell_memberships m WHERE m."cellId"=p.id AND m."endDate" IS NULL AND m."startDate"<=${day}::date AND m.role='LEADER') leaders FROM cells p WHERE (${scoped})${conditions.length?' AND '+conditions.join(' AND '):''} ORDER BY p."displayCode",p.id`;
  else{
   const selected=(birthday?['names','lastNames','birthDate','phone','sex','status']:fields.filter(f=>!['notes','alternatePhone','municipality','province','postalCode'].includes(f.key)).map(f=>f.key)).map(k=>`p."${k}"`).join(',');
   sql=`WITH permitted AS (SELECT p.* FROM people p WHERE ${scoped}), counted AS (SELECT p.*,${birthday?'0 duplicate_document,0 duplicate_phone,0 duplicate_name':'count(*) OVER(PARTITION BY "documentKey") duplicate_document,count(*) OVER(PARTITION BY "phoneKey") duplicate_phone,count(*) OVER(PARTITION BY "nameKey") duplicate_name'} FROM permitted p)
   SELECT p.id,${selected},p."sortName",EXISTS(SELECT 1 FROM office_contacts bad WHERE bad.person_id=p.id AND bad.result='NUMERO_INCORRECTO' AND bad.phone_key=p."phoneKey" AND NOT EXISTS(SELECT 1 FROM office_contacts good WHERE good.person_id=p.id AND good.result='CONTACTO_ESTABLECIDO' AND good.type='CALL' AND good.phone_key=p."phoneKey" AND good.occurred_at>=bad.occurred_at)) "reportedWrongPhone",CASE WHEN p."documentKey" IS NOT NULL THEN p.duplicate_document ELSE 0 END duplicate_document,CASE WHEN p."phoneKey"<>'' THEN p.duplicate_phone ELSE 0 END duplicate_phone,CASE WHEN p."nameKey"<>'' THEN p.duplicate_name ELSE 0 END duplicate_name,
   coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'displayCode',c."displayCode",'gender',c.gender,'role',m.role) ORDER BY c."displayCode") FROM cell_memberships m JOIN cells c ON c.id=m."cellId" WHERE m."personId"=p.id AND m."endDate" IS NULL AND m."startDate"<=${day}::date AND c.status='ACTIVE' AND (${visibleCells})),'[]') cells,
   (SELECT count(*) FROM cell_memberships m JOIN cells c ON c.id=m."cellId" WHERE m."personId"=p.id AND m."endDate" IS NULL AND m."startDate"<=${day}::date AND c.status='ACTIVE' AND (${visibleCells}))::int "membershipCount",
   ${canAdmin?`EXISTS(SELECT 1 FROM users u WHERE u.person_id=p.id AND u.active)`:'false'} "activeUser"
   FROM counted p${where} ORDER BY p."sortName",p.id`;
  }
  let total=0,missingBirthDate=0;const summary={total:0,complete:0,incomplete:0,review:0,duplicates:0,average:0,problems:{}},items=[],choices=new Map();
  const offset=(q.page-1)*20,limit=q.page*20;let sum=0;
  await scan(pool,sql,values,p=>{
   if(isCell){if(choices.size<500)choices.set(p.id,p.displayCode);}else for(const c of p.cells)if(choices.size<500)choices.set(c.id,c.displayCode);
   if(birthday){const b=birthdayInfo(p.birthDate,today);if(!b){missingBirthDate++;return;}
    if(!birthdayInRange(p.birthDate,range)||q.month&&Number(p.birthDate.slice(5,7))!==Number(q.month)||q.minAge!==null&&b.age<q.minAge||q.maxAge!==null&&b.age>q.maxAge)return;
    total++;const item={id:p.id,names:p.names,lastNames:p.lastNames,birthDate:p.birthDate,phone:p.phone,status:p.status,cells:p.cells,birthday:b};
    const compare=(a,b)=>a.birthday.days-b.birthday.days||a.lastNames.localeCompare(b.lastNames,'es')||a.names.localeCompare(b.names,'es')||a.id.localeCompare(b.id);
    let low=0,high=items.length;while(low<high){const mid=(low+high)>>>1;if(compare(items[mid],item)<=0)low=mid+1;else high=mid;}
    if(low<limit){items.splice(low,0,item);if(items.length>limit)items.pop();}return;
   }
   const quality=isCell?cellQuality(p):personQuality(p,today);summary.total++;sum+=quality.completeness.percent||0;
   summary[quality.completeness.complete?'complete':'incomplete']++;
   if(quality.problems.some(p=>p.severity!=='recommended'))summary.review++;
   if(quality.problems.some(p=>p.code.startsWith('duplicate_')))summary.duplicates++;
   for(const problem of quality.problems)summary.problems[problem.code]=(summary.problems[problem.code]||0)+1;
   if(q.completeness==='complete'&&!quality.completeness.complete||q.completeness==='incomplete'&&quality.completeness.complete||!matchesProblem(quality,q.problem))return;
   total++;if(total<=offset||items.length>=20)return;
   items.push({id:p.id,...(isCell?{displayCode:p.displayCode}:{names:p.names,lastNames:p.lastNames,cells:p.cells}),status:p.status,...quality});
  });
  summary.average=summary.total?Math.round(sum/summary.total):null;
  return {items:birthday?items.slice(offset):items,total,page:q.page,pages:Math.max(1,Math.ceil(total/20)),pageSize:20,today,timezone,range,...(birthday?{missingBirthDate}:{summary,problemLabels}),cells:[...choices].map(([id,displayCode])=>({id,displayCode})).sort((a,b)=>a.displayCode.localeCompare(b.displayCode))};
 }
 return {dashboard:createDashboardService(pool,{timezone,now}),birthdays:(q,u)=>list('birthdays',q,u),people:(q,u)=>list('people',q,u),cells:(q,u)=>list('cells',q,u)};
}
