import {fields,completenessFields,completeness,normalizeText,normalizePhone} from '../../src/domain/person.js';
import {DomainError} from '../core/errors.mjs';
import {randomUUID} from 'node:crypto';
const columns=['id',...fields.map(field=>field.key),'createdAt','updatedAt','version'];
export const quote=key=>`"${key}"`; // callers supply only internal, fixed schema keys
const select=columns.map(quote).join(',');
export async function getPerson(client,id,{lock=false}={}) {
 const row=(await client.query(`SELECT ${select} FROM people WHERE id=$1${lock?' FOR UPDATE':''}`,[id])).rows[0];
 if(!row)throw new DomainError(404,'No encontramos a esta persona.');
 return {...row,completeness:completeness(row)};
}
export function scopedWhere(scope,values) {
 if(scope?.all)return 'TRUE';
 values.push(scope?.ids || []);return `id=ANY($${values.length}::uuid[])`;
}
export async function listPeople(client,query={},scope={all:true}) {
 const values=[];const bind=value=>{values.push(value);return `$${values.length}`;};
 const where=[scopedWhere(scope,values)];
 const q=normalizeText(query.q).slice(0,150);
 if(q){
  const like=value=>`%${value.replace(/[\\%_]/g,'\\$&')}%`;
  let clause=q.split(' ').filter(Boolean).map(token=>`"searchText" LIKE ${bind(like(token))} ESCAPE '\\'`).join(' AND ');
  if(normalizePhone(q)&&/^[+\d\s().-]+$/.test(q)){const number=bind(like(normalizePhone(q)));clause=`(${clause}) OR "phoneKey" LIKE ${number} OR "documentKey" LIKE ${number}`;}
  where.push(`(${clause})`);
 }
 for(const key of ['status','sex'])if(query[key])where.push(`${quote(key)}=${bind(query[key])}`);
 if(query.office){
  if(query.office!=='NONE'&&!(await client.query('SELECT 1 FROM ecclesiastical_offices WHERE id=$1',[query.office])).rowCount)throw new DomainError(422,'Cargo no válido.');
  where.push(query.office==='NONE'?'NOT EXISTS(SELECT 1 FROM ecclesiastical_appointments a WHERE a.person_id=people.id)':`EXISTS(SELECT 1 FROM ecclesiastical_appointments a WHERE a.person_id=people.id AND a.office_id=${bind(query.office)} AND NOT EXISTS(SELECT 1 FROM ecclesiastical_appointments newer WHERE newer.person_id=a.person_id AND (newer.effective_date>a.effective_date OR (newer.effective_date=a.effective_date AND newer.sequence>a.sequence))))`);
 }
 if(query.locality)where.push(`"localityKey"=${bind(normalizeText(query.locality))}`);
 const complete=completenessFields.map(key=>`${quote(key)} IS NOT NULL`).join(' AND ');
 if(query.completeness==='complete')where.push(`(${complete})`);
 if(query.completeness==='incomplete')where.push(`NOT (${complete})`);
 const filter=` WHERE ${where.join(' AND ')}`;
 const total=Number((await client.query(`SELECT count(*) AS n FROM people${filter}`,values)).rows[0].n);
 const pageSize=Math.min(50,Math.max(1,Number.parseInt(query.pageSize)||20)),pages=Math.max(1,Math.ceil(total/pageSize));
 const page=Math.min(pages,Math.max(1,Number.parseInt(query.page)||1));
 const order={name:'sortName',updatedAt:'updatedAt',joinedDate:'joinedDate'};
 const sort=Object.hasOwn(order,query.sort)?order[query.sort]:order.name;
 const sql=`SELECT ${select} FROM people${filter} ORDER BY ${quote(sort)} ${query.direction==='desc'?'DESC':'ASC'} NULLS LAST,id ASC LIMIT ${bind(pageSize)} OFFSET ${bind((page-1)*pageSize)}`;
 const rows=(await client.query(sql,values)).rows;
 return {items:rows.map(row=>({id:row.id,names:row.names,lastNames:row.lastNames,document:row.document,phone:row.phone,locality:row.locality,status:row.status,completeness:completeness(row)})),total,page,pageSize,pages};
}
export async function localities(client,scope={all:true}) {
 const values=[],condition=scopedWhere(scope,values);
 return (await client.query(`SELECT min(locality) AS locality FROM people WHERE locality IS NOT NULL AND (${condition}) GROUP BY "localityKey" ORDER BY "localityKey" LIMIT 500`,values)).rows.map(row=>row.locality);
}
export async function history(client,id,page=1) {
 await getPerson(client,id);
 const total=Number((await client.query('SELECT count(*) AS n FROM person_events WHERE "personId"=$1',[id])).rows[0].n);
 const pages=Math.max(1,Math.ceil(total/20));page=Math.min(pages,Math.max(1,Number.parseInt(page)||1));
 const items=(await client.query('SELECT id,type,source,summary,"actorId","occurredAt" FROM person_events WHERE "personId"=$1 ORDER BY "occurredAt" DESC,sequence DESC LIMIT 20 OFFSET $2',[id,(page-1)*20])).rows;
 return {items,page,pages,total};
}
export const lockName=(client,name)=>client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[name]);
export async function documentExists(client,key,id) {return key&&Boolean((await client.query('SELECT id FROM people WHERE "documentKey"=$1 AND ($2::uuid IS NULL OR id!=$2)',[key,id])).rowCount);}
export async function nameMatches(client,name,id,scope) {
 const values=[name,id],condition=scopedWhere(scope,values);
 return (await client.query(`SELECT id,names,"lastNames" FROM people WHERE "nameKey"=$1 AND ($2::uuid IS NULL OR id!=$2) AND (${condition}) LIMIT 5`,values)).rows;
}
export async function persistPerson(client,personId,stored,isUpdate,now) {
 if(isUpdate){const keys=Object.keys(stored);await client.query(`UPDATE people SET ${keys.map((key,i)=>`${quote(key)}=$${i+1}`).join(',')},version=version+1 WHERE id=$${keys.length+1}`,[...keys.map(key=>stored[key]),personId]);}
 else{const record={id:personId,...stored,createdAt:now},keys=Object.keys(record);await client.query(`INSERT INTO people(${keys.map(quote).join(',')}) VALUES(${keys.map((_,i)=>`$${i+1}`).join(',')})`,keys.map(key=>record[key]));}
}
export async function appendPersonEvents(client,personId,events,actorId,now) {
 for(const [type,summary] of events)await client.query('INSERT INTO person_events(id,"personId",type,source,summary,"actorId","occurredAt") VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),personId,type,'people',summary,actorId,now]);
}
