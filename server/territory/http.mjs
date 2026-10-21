import {Router} from 'express';
import {DomainError} from '../core/errors.mjs';
import {territoryScope} from './policy.mjs';
import {cellCapabilities} from '../cells/policy.mjs';
import {tileProvider} from './provider.mjs';
const validCoordinates='latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180';
export function territoryRouter(pool,{provider=tileProvider()}={}){
 const router=Router();
 router.get('/cells',async(req,res)=>{
  const scope=territoryScope(req.user),q=req.query,allowed=['q','locality','gender','ageMin','ageMax','status','location','page'];
  if(Object.entries(q).some(([k,v])=>!allowed.includes(k)||typeof v!=='string'||v.length>100)||
   q.gender&&!['F','M'].includes(q.gender)||q.status&&!['ACTIVE','CLOSED','ALL'].includes(q.status)||
   q.location&&!['valid','missing','verified','pending'].includes(q.location)||
   ['ageMin','ageMax'].some(k=>q[k]!==undefined&&(!/^\d{1,3}$/.test(q[k])))||
   q.ageMin!==undefined&&q.ageMax!==undefined&&Number(q.ageMin)>Number(q.ageMax)||
   q.page!==undefined&&(!/^\d{1,6}$/.test(q.page)||Number(q.page)<1))throw new DomainError(422,'Revisá los filtros del mapa.');
  const values=[scope.all,scope.ids],where=['($1 OR id=ANY($2::uuid[]))'];const bind=value=>{values.push(value);return '$'+values.length;};
  if(q.status!=='ALL')where.push(`status=${bind(q.status||'ACTIVE')}`);
  if(q.q)where.push(`"displayCode" ILIKE ${bind('%'+q.q.trim().replace(/[\\%_]/g,'\\$&')+'%')}`);
  if(q.locality)where.push(`locality ILIKE ${bind('%'+q.locality.trim().replace(/[\\%_]/g,'\\$&')+'%')}`);
  if(q.gender)where.push(`gender=${bind(q.gender)}`);
  // Interval overlap is descriptive filtering, never a membership eligibility rule.
  if(q.ageMin!==undefined)where.push(`("ageUnrestricted" IS TRUE OR "recommendedAgeMax" IS NULL OR "recommendedAgeMax">=${bind(Number(q.ageMin))})`);
  if(q.ageMax!==undefined)where.push(`("ageUnrestricted" IS TRUE OR "recommendedAgeMin" IS NULL OR "recommendedAgeMin"<=${bind(Number(q.ageMax))})`);
  if(q.ageMin!==undefined||q.ageMax!==undefined)where.push('("ageUnrestricted" IS TRUE OR "recommendedAgeMin" IS NOT NULL OR "recommendedAgeMax" IS NOT NULL)');
  if(q.location==='valid')where.push(`(${validCoordinates})`);
  if(q.location==='missing')where.push(`NOT (${validCoordinates})`);
  if(q.location==='verified')where.push(`(${validCoordinates}) AND "coordinateStatus"='VERIFIED'`);
  if(q.location==='pending')where.push(`(${validCoordinates}) AND "coordinateStatus" IS DISTINCT FROM 'VERIFIED'`);
  const filter=where.join(' AND '),pageSize=500;
  // One snapshot and two bounded SQL queries: no per-cell/person queries.
  const db=await pool.connect();let result;
  try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const totals=(await db.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE NOT (${validCoordinates}))::int AS "missingLocation" FROM cells WHERE ${filter}`,values)).rows[0];
   const pages=Math.max(1,Math.ceil(totals.total/pageSize)),page=Math.min(pages,Number(q.page)||1);
   const items=(await db.query(`SELECT id,"displayCode",status,gender,locality,"recommendedAgeMin","recommendedAgeMax","ageUnrestricted",CASE WHEN ${validCoordinates} THEN latitude ELSE NULL END AS latitude,CASE WHEN ${validCoordinates} THEN longitude ELSE NULL END AS longitude,CASE WHEN ${validCoordinates} THEN coalesce("coordinateStatus",'PENDING') ELSE NULL END AS "coordinateStatus","coverageRadiusMeters" FROM cells WHERE ${filter} ORDER BY "groupCode",generation,gender,id LIMIT ${bind(pageSize)} OFFSET ${bind((page-1)*pageSize)}`,values)).rows;
   result={...totals,page,pageSize,pages,provider,items:items.map(c=>({...c,canOpenCell:cellCapabilities(req.user,c.id).ver}))};await db.query('COMMIT');
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
  res.json(result);
 });
 return router;
}
