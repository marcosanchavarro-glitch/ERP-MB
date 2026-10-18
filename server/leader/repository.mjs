import {normalizeText} from '../../src/domain/person.js';
import {nextBirthday} from '../../src/domain/birthday.js';
import {installationToday} from '../core/calendar.mjs';
import {personDTO} from './projection.mjs';
const memberFields='p.id,p.names,p."lastNames",p.phone,p."birthDate",m.role';
const current='FROM cell_memberships m JOIN people p ON p.id=m."personId" WHERE m."cellId"=$1 AND m."endDate" IS NULL';
export async function members(db,id,{q='',page=1}){const values=[id,'%'+normalizeText(q).replace(/[\\%_]/g,'\\$&')+'%'];const filter=current+' AND p."sortName" LIKE $2';const total=Number((await db.query('SELECT count(*) AS n '+filter,values)).rows[0].n);return {total,page,pages:Math.max(1,Math.ceil(total/50)),items:(await db.query('SELECT '+memberFields+' '+filter+' ORDER BY p."sortName",p.id LIMIT 50 OFFSET $3',[...values,(page-1)*50])).rows.map(personDTO)};}
export async function person(db,cellId,personId){return (await db.query('SELECT '+memberFields+' '+current+' AND p.id=$2',[cellId,personId])).rows[0];}
export async function birthdays(db,id){const rows=(await db.query('SELECT p.id,p.names,p."lastNames",p."birthDate" '+current+' AND p."birthDate" IS NOT NULL',[id])).rows;const items=rows.map(p=>({...p,birthday:nextBirthday(p.birthDate,installationToday())})).filter(p=>p.birthday.days<=30).sort((a,b)=>a.birthday.days-b.birthday.days||a.lastNames.localeCompare(b.lastNames));return {total:items.length,items:items.slice(0,50)};}
export const count=async(db,id)=>Number((await db.query('SELECT count(*) AS n FROM cell_memberships WHERE "cellId"=$1 AND "endDate" IS NULL',[id])).rows[0].n);
export const currentIds=async(db,id)=>(await db.query('SELECT "personId" FROM cell_memberships WHERE "cellId"=$1 AND "endDate" IS NULL',[id])).rows.map(r=>r.personId);
