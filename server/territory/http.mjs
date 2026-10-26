import {Router} from 'express';
import {evangelismRouter} from './evangelism-http.mjs';
import {DomainError} from '../core/errors.mjs';
import {territoryScope} from './policy.mjs';
import {cellCapabilities} from '../cells/policy.mjs';
import {tileProvider} from './provider.mjs';
import {centralSite} from './locations.mjs';
import {referenceView} from './geocoding.mjs';
import {scopeFor} from '../identity/authorization.mjs';
import {csrfGuard} from '../identity/http.mjs';
import {recommendCells,savePersonLocation} from './recommendations.mjs';
import {validCoordinates,territoryFilters} from './filters.mjs';
import {territorialAnalysis} from './analysis.mjs';
import {territorialUnits,saveTerritorialUnit,assignTerritory,canManageTerritory} from './organization.mjs';
export function territoryRouter(pool,{provider=tileProvider()}={}){
 const router=Router();
 router.use('/evangelism',evangelismRouter(pool,{provider}));
 router.get('/units',async(req,res)=>res.json(await territorialUnits(pool,req.user)));
 router.post('/units',csrfGuard,async(req,res)=>res.status(201).json(await saveTerritorialUnit(pool,null,req.body,req.user,req.requestId)));
 router.put('/units/:id',csrfGuard,async(req,res)=>res.json(await saveTerritorialUnit(pool,req.params.id,req.body,req.user,req.requestId)));
 router.put('/cells/:id/territory',csrfGuard,async(req,res)=>res.json(await assignTerritory(pool,req.params.id,req.body,req.user,req.requestId)));

 router.get('/recommendations/:id',async(req,res)=>res.json(await recommendCells(pool,req.params.id,req.user)));
 router.put('/recommendations/:id/location',csrfGuard,async(req,res)=>res.json(await savePersonLocation(pool,req.params.id,req.body,req.user,req.requestId)));
 router.get('/cells',async(req,res)=>{
  const q=req.query,scope=territoryScope(req.user,q.analysis==='true'?'territorio-analisis':'territorio-mapa');
  const {values,where,bind}=territoryFilters(q,scope);
  const filter=where.join(' AND '),pageSize=500;
  // One snapshot and two bounded SQL queries: no per-cell/person queries.
  const db=await pool.connect();let result;
  try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const totals=(await db.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE NOT (${validCoordinates}))::int AS "missingLocation" FROM cells WHERE ${filter}`,values)).rows[0];
   const analysis=q.analysis==='true'?await territorialAnalysis(db,filter,values,scope,q):null;
   const pages=Math.max(1,Math.ceil(totals.total/pageSize)),page=Math.min(pages,Number(q.page)||1);
   const items=(await db.query(`SELECT id,"displayCode",status,gender,country,province,municipality,locality,ct.unit_id AS "territoryUnitId",coalesce(ct.version,0) AS "territoryVersion","recommendedAgeMin","recommendedAgeMax","ageUnrestricted",CASE WHEN ${validCoordinates} THEN latitude ELSE NULL END AS latitude,CASE WHEN ${validCoordinates} THEN longitude ELSE NULL END AS longitude,CASE WHEN ${validCoordinates} THEN coalesce("coordinateStatus",'PENDING') ELSE NULL END AS "coordinateStatus","coverageRadiusMeters","locationVerification"->>'accuracy' AS "locationAccuracy" FROM cells LEFT JOIN cell_territory ct ON ct.cell_id=cells.id WHERE ${filter} ORDER BY (id=${bind(q.focus||null)}::uuid) DESC NULLS LAST,"groupCode",generation,gender,id LIMIT ${bind(pageSize)} OFFSET ${bind((page-1)*pageSize)}`,values)).rows;
   const central=await centralSite(db);central.locationAccuracy=central.verification?.accuracy||null;delete central.verification;
   result={...totals,analysis,canManageTerritory:canManageTerritory(req.user),page,pageSize,pages,provider,central,reference:referenceView(),canManageSite:scopeFor(req.user,'admin.usuarios.gestionar').all,canManageCells:scopeFor(req.user,'celulas.editar').all,items:items.map(c=>({...c,canOpenCell:cellCapabilities(req.user,c.id).ver}))};await db.query('COMMIT');
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
  res.json(result);
 });
 return router;
}
