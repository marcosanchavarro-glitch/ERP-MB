import {randomUUID} from 'node:crypto';
import {cellFields} from '../../src/domain/cell.js';
import {DomainError} from '../core/errors.mjs';
import {calendarToday} from '../../src/domain/calendar.js';
export const get=async(db,id)=>{const row=(await db.query('SELECT * FROM cells WHERE id=$1',[id])).rows[0];if(!row)throw new DomainError(404,'No encontramos esta célula.');return row;};
export async function lockCells(db,ids){await db.query('SELECT id FROM cells WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[[...new Set(ids)].sort()]);}
export async function lockPeople(db,ids){const r=await db.query('SELECT id FROM people WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[ids]);if(r.rowCount!==new Set(ids).size)throw new DomainError(404,'No encontramos a una de las personas.');}
export const currentMembers=async(db,id)=>(await db.query('SELECT * FROM cell_memberships WHERE "cellId"=$1 AND "endDate" IS NULL ORDER BY "personId"',[id])).rows;
export const activeForPerson=async(db,id)=>(await db.query('SELECT * FROM cell_memberships WHERE "personId"=$1 AND "endDate" IS NULL',[id])).rows[0];
export const latestEnd=async(db,id)=>(await db.query('SELECT max("endDate") AS date FROM cell_memberships WHERE "personId"=$1',[id])).rows[0].date;
export async function saveCell(db,cell,id,locationChanged=false){const keys=cellFields.map(f=>f.key),values=keys.map(k=>cell[k]);if(id)await db.query(`UPDATE cells SET ${keys.map((k,i)=>`"${k}"=$${i+1}`).join(',')},version=version+1,"updatedAt"=now(),"locationUpdatedAt"=CASE WHEN ${locationChanged?'true':'false'} THEN now() ELSE "locationUpdatedAt" END,"lastEffectiveDate"=greatest("lastEffectiveDate",$${keys.indexOf('openedDate')+1}::date) WHERE id=$${values.length+1}`,[...values,id]);else {id=randomUUID();await db.query(`INSERT INTO cells(id,${keys.map(k=>`"${k}"`).join(',')},"lastEffectiveDate","locationUpdatedAt") VALUES($1,${keys.map((_,i)=>`$${i+2}`).join(',')},$${keys.indexOf('openedDate')+2},${locationChanged?'now()':'NULL'})`,[id,...values]);}return get(db,id);}
export const touch=(db,id,date)=>db.query('UPDATE cells SET version=version+1,"updatedAt"=now(),"lastEffectiveDate"=$2 WHERE id=$1',[id,date]);
export const closeCell=(db,id,date)=>db.query('UPDATE cells SET status=\'CLOSED\',"closedDate"=$2 WHERE id=$1',[id,date]);
export async function operation(db,input){const id=randomUUID();await db.query('INSERT INTO cell_operations(id,kind,"sourceCellId","destinationCellId","effectiveDate",reason,"actorId") VALUES($1,$2,$3,$4,$5,$6,$7)',[id,input.kind,input.source,input.destination||null,input.date,input.reason||null,input.actorId]);return id;}
export async function start(db,{cellId,personId,role,date,operationId}){const id=randomUUID();await db.query('INSERT INTO cell_memberships(id,"cellId","personId",role,"startDate","startOperationId") VALUES($1,$2,$3,$4,$5,$6)',[id,cellId,personId,role,date,operationId]);return {id,cellId,personId,role,startDate:date,endDate:null};}
export const end=(db,id,date,operationId)=>db.query('UPDATE cell_memberships SET "endDate"=$2,"endOperationId"=$3 WHERE id=$1 AND "endDate" IS NULL',[id,date,operationId]);
export const event=(db,{cellId,personId=null,operationId=null,summary,date,actorId})=>db.query('INSERT INTO cell_events(id,"cellId","personId","operationId",summary,"effectiveDate","actorId") VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),cellId,personId,operationId,summary,date,actorId]);
export const pageInfo=(query,total)=>{const pageSize=Math.min(50,Math.max(1,Number(query.pageSize)||20)),pages=Math.max(1,Math.ceil(total/pageSize)),page=Math.min(pages,Math.max(1,Number(query.page)||1));return {total,pageSize,pages,page};};
export async function list(db,q,scope){
 const v=[scope.all,scope.ids],where=['($1 OR id=ANY($2::uuid[]))'];const bind=x=>{v.push(x);return '$'+v.length;};
 if(q.q)where.push(`"displayCode" ILIKE ${bind('%'+q.q.trim().replace(/[\\%_]/g,'\\$&')+'%')}`);
 for(const k of ['status','gender','groupCode','meetingDay'])if(q[k])where.push(`"${k}"=${bind(q[k])}`);
 if(q.locality)where.push(`lower(locality)=lower(${bind(q.locality)})`);
 const filter=where.join(' AND '),total=Number((await db.query(`SELECT count(*) AS n FROM cells WHERE ${filter}`,v)).rows[0].n),p=pageInfo(q,total);
 const orders={code:'"groupCode",generation,gender',openedDate:'"openedDate"',locality:'locality'};const order=Object.hasOwn(orders,q.sort)?orders[q.sort]:orders.code;
 const items=(await db.query(`SELECT id,"displayCode",status,"openedDate","meetingDay","meetingTime",address,locality FROM cells WHERE ${filter} ORDER BY ${order.split(',').map(k=>k+(q.direction==='desc'?' DESC':' ASC')).join(',')},id LIMIT ${bind(p.pageSize)} OFFSET ${bind((p.page-1)*p.pageSize)}`,v)).rows;
 const counts=(await db.query('SELECT "cellId",count(*)::int AS total,count(*) FILTER(WHERE role=\'LEADER\')::int AS leaders FROM cell_memberships WHERE "endDate" IS NULL AND "cellId"=ANY($1::uuid[]) GROUP BY "cellId"',[items.map(x=>x.id)])).rows;
 return {...p,items:items.map(c=>({...c,...(counts.find(n=>n.cellId===c.id)||{total:0,leaders:0})}))};
}
export async function members(db,id,q,personScope){
 const total=Number((await db.query('SELECT count(*) AS n FROM cell_memberships WHERE "cellId"=$1 AND "endDate" IS NULL',[id])).rows[0].n),p=pageInfo(q,total);
 const items=(await db.query(`SELECT m.*,CASE WHEN $4 OR m."personId"=ANY($5::uuid[]) THEN json_build_object('id',p.id,'names',p.names,'lastNames',p."lastNames") ELSE NULL END AS person FROM cell_memberships m JOIN people p ON p.id=m."personId" WHERE m."cellId"=$1 AND m."endDate" IS NULL ORDER BY CASE role WHEN 'LEADER' THEN 0 WHEN 'ASSISTANT' THEN 1 ELSE 2 END,p."sortName",m.id LIMIT $2 OFFSET $3`,[id,p.pageSize,(p.page-1)*p.pageSize,personScope.all,personScope.ids])).rows;
 return {...p,items};
}
export async function history(db,id,q,personScope,cellScope){
 const total=Number((await db.query('SELECT count(*) AS n FROM cell_events WHERE "cellId"=$1',[id])).rows[0].n),p=pageInfo(q,total);
 const items=(await db.query(`SELECT e.*,o.reason,
 CASE WHEN $4 OR e."personId"=ANY($5::uuid[]) THEN json_build_object('id',person.id,'names',person.names,'lastNames',person."lastNames") ELSE NULL END AS person,
 CASE WHEN other.id IS NOT NULL AND ($6 OR other.id=ANY($7::uuid[])) THEN json_build_object('id',other.id,'displayCode',other."displayCode") ELSE NULL END AS "relatedCell"
 FROM cell_events e LEFT JOIN people person ON person.id=e."personId"
 LEFT JOIN cell_operations o ON o.id=e."operationId"
 LEFT JOIN cell_memberships next ON next."startOperationId"=o.id AND next."personId"=e."personId"
 LEFT JOIN cells other ON other.id=CASE WHEN e."cellId"=o."sourceCellId" THEN coalesce(next."cellId",o."destinationCellId") ELSE o."sourceCellId" END AND other.id<>e."cellId"
 WHERE e."cellId"=$1 ORDER BY e.sequence DESC LIMIT $2 OFFSET $3`,[id,p.pageSize,(p.page-1)*p.pageSize,personScope.all,personScope.ids,cellScope.all,cellScope.ids])).rows;
 return {...p,items};
}
export async function personHistory(db,id,q,scope){const total=Number((await db.query('SELECT count(*) AS n FROM cell_memberships WHERE "personId"=$1 AND ($2 OR "cellId"=ANY($3::uuid[]))',[id,scope.all,scope.ids])).rows[0].n),p=pageInfo(q,total);
 const select=`SELECT m.*,c."displayCode",c.status,c."meetingDay",c."meetingTime",c.locality FROM cell_memberships m JOIN cells c ON c.id=m."cellId" WHERE m."personId"=$1 AND ($2 OR m."cellId"=ANY($3::uuid[]))`;
 return {...p,current:(await db.query(select+' AND m."endDate" IS NULL',[id,scope.all,scope.ids])).rows[0]||null,items:(await db.query(select+' ORDER BY m."startDate" DESC,m.sequence DESC LIMIT $4 OFFSET $5',[id,scope.all,scope.ids,p.pageSize,(p.page-1)*p.pageSize])).rows};
}

export const earliestStart=async(db,id)=>(await db.query('SELECT min("startDate") AS date FROM cell_memberships WHERE "cellId"=$1',[id])).rows[0].date;
export async function ageStatistics(db,id,personScope,date=calendarToday()){
 // Same birthday convention as birthdayInfo: February 29 ages on February 28
 // in non-leap years. Aggregate in SQL, without returning birthdays or persons.
 const row=(await db.query(`WITH population AS (
  SELECT p.id,p."birthDate",CASE WHEN p."birthDate" IS NOT NULL AND p."birthDate"<=$2::date THEN
   extract(year FROM $2::date)::int-extract(year FROM p."birthDate")::int-
   CASE WHEN make_date(extract(year FROM $2::date)::int,extract(month FROM p."birthDate")::int,
    least(extract(day FROM p."birthDate")::int,extract(day FROM (date_trunc('month',make_date(extract(year FROM $2::date)::int,extract(month FROM p."birthDate")::int,1))+interval '1 month - 1 day'))::int))>$2::date THEN 1 ELSE 0 END
   ELSE NULL END AS age
  FROM cell_memberships m JOIN people p ON p.id=m."personId"
  WHERE m."cellId"=$1 AND m.role='MEMBER' AND m."startDate"<=$2::date AND (m."endDate" IS NULL OR m."endDate">$2::date)
 ) SELECT min(age)::int AS minimum,max(age)::int AS maximum,round(avg(age),1)::float8 AS average,
 count(age)::int AS known,count(*) FILTER(WHERE age IS NULL)::int AS unknown,
 count(*) FILTER(WHERE NOT ($3 OR id=ANY($4::uuid[])))::int AS hidden FROM population`,[id,date,personScope.all,personScope.ids])).rows[0];
 if(row.hidden)return null;
 const {hidden,...stats}=row;return {...stats,asOf:date,population:'MEMBER'};
}
export async function availability(db,ids){return (await db.query(`SELECT p.id,p.sex,m.id AS "membershipId",m."cellId",m.role,c."displayCode",c.version AS "cellVersion" FROM people p LEFT JOIN cell_memberships m ON m."personId"=p.id AND m."endDate" IS NULL LEFT JOIN cells c ON c.id=m."cellId" WHERE p.id=ANY($1::uuid[])`,[ids])).rows;}
export const latestEnds=async(db,ids)=>(await db.query('SELECT "personId",max("endDate") AS date FROM cell_memberships WHERE "personId"=ANY($1::uuid[]) GROUP BY "personId"',[ids])).rows;
export const activeByCode=async(db,c)=>(await db.query('SELECT * FROM cells WHERE "groupCode"=$1 AND generation=$2 AND gender=$3 AND status=\'ACTIVE\'',[c.groupCode,c.generation,c.gender])).rows[0];
export const lockCode=(db,code)=>db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,412004))',[code]);
export const activeByCodes=async(db,codes)=>(await db.query('SELECT * FROM cells WHERE status=\'ACTIVE\' AND "displayCode"=ANY($1::text[])',[codes])).rows;
