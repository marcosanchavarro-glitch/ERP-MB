import {Router} from 'express';
import {csrfGuard} from '../identity/http.mjs';
import {evangelismAccess,evangelismCapabilities,canEvangelism} from './evangelism-policy.mjs';
import {saveOuting,changeOutingState,saveOutingRoute,outingDetail} from './evangelism-service.mjs';
import {listOutings,evangelismStatistics} from './evangelism-query.mjs';
import {treeSQL} from './organization.mjs';
import {scopeFor,requirePermission} from '../identity/authorization.mjs';
import {territoryAccess} from './policy.mjs';
import {centralSite} from './locations.mjs';
import {referenceView} from './geocoding.mjs';
import {installationToday} from '../core/calendar.mjs';
import {DomainError} from '../core/errors.mjs';
import {normalizeText} from '../../src/domain/person.js';
import {moduleCatalog} from '../identity/modules.mjs';
import {shape} from '../cells/policy.mjs';
export function evangelismRouter(pool,{provider}){
 const r=Router();
 r.get('/meta',async(req,res)=>{
  if(!canEvangelism(req.user)){evangelismAccess(req.user);}
  const capabilities=evangelismCapabilities(req.user),people=scopeFor(req.user,'personas.ver');
  const units=(await pool.query(`${treeSQL} SELECT id,level,parent_id,label,name,active FROM tree WHERE level IN ('ZONE','SECTOR') ORDER BY label,id LIMIT 2000`)).rows;
  const responsibles=(await pool.query(`SELECT u.id,coalesce(nullif(concat_ws(' ',p.names,p."lastNames"),''),u.username) label FROM users u LEFT JOIN people p ON p.id=u.person_id WHERE (u.active AND $1) OR EXISTS(SELECT 1 FROM evangelism_outings o WHERE o.responsible_id=u.id) ORDER BY label,u.id LIMIT 200`,[capabilities.crear||capabilities.editar])).rows;
  let mapBase=null;
  if(capabilities.ver){const central=await centralSite(pool);central.locationAccuracy=central.verification?.accuracy||null;delete central.verification;
   const cellScope=scopeFor(req.user,'celulas.ver'),readCells=territoryAccess(req.user),items=readCells?(await pool.query(`SELECT id,"displayCode",status,gender,locality,"recommendedAgeMin","recommendedAgeMax","ageUnrestricted",latitude,longitude,"coordinateStatus","coverageRadiusMeters" FROM cells WHERE status='ACTIVE' AND ($1 OR id=ANY($2::uuid[])) ORDER BY "groupCode",generation,gender,id LIMIT 500`,[cellScope.all,cellScope.ids])).rows:[];
   mapBase={items:items.map(c=>({...c,canOpenCell:false})),central,provider,reference:referenceView(),total:items.length,missingLocation:items.filter(c=>c.latitude===null||c.longitude===null).length,page:1,pages:1,pageSize:500,canManageSite:false,canManageCells:false,canManageTerritory:false};
  }
  res.json({capabilities,units,responsibles,organizers:moduleCatalog.map(a=>a.name),canLinkParticipants:(people.all||people.ids.length>0)&&(capabilities.crear||capabilities.editar),today:installationToday(),mapBase});
 });
 r.get('/people',async(req,res)=>{
  evangelismAccess(req.user);const caps=evangelismCapabilities(req.user);if(!caps.crear&&!caps.editar)throw new DomainError(403,'Esta herramienta no está disponible.');const scope=requirePermission(req.user,'personas.ver');shape(req.query,['q']);if(typeof req.query.q!=='string'||req.query.q.length>100)throw new DomainError(422,'Revisá el nombre de búsqueda.');
  const q=normalizeText(req.query.q);if(q.length<2){res.json({items:[]});return;}
  const items=(await pool.query(`SELECT id,names,"lastNames" FROM people WHERE ($1 OR id=ANY($2::uuid[])) AND "sortName" LIKE $3 ESCAPE '\\' ORDER BY "sortName",id LIMIT 20`,[scope.all,scope.ids,'%'+q.replace(/[\\%_]/g,'\\$&')+'%'])).rows;res.json({items});
 });
 r.get('/outings',async(req,res)=>res.json(await listOutings(pool,req.query,req.user)));
 r.get('/routes',async(req,res)=>res.json(await listOutings(pool,req.query,req.user,{routes:true})));
 r.get('/statistics',async(req,res)=>res.json(await evangelismStatistics(pool,req.query,req.user)));
 r.get('/outings/:id',async(req,res)=>{shape(req.query,['page']);res.json(await outingDetail(pool,req.params.id,req.user,req.query.page||1));});
 r.post('/outings',csrfGuard,async(req,res)=>res.status(201).json(await saveOuting(pool,null,req.body,req.user,req.requestId)));
 r.put('/outings/:id',csrfGuard,async(req,res)=>res.json(await saveOuting(pool,req.params.id,req.body,req.user,req.requestId)));
 r.post('/outings/:id/state',csrfGuard,async(req,res)=>res.json(await changeOutingState(pool,req.params.id,req.body,req.user,req.requestId)));
 r.put('/outings/:id/route',csrfGuard,async(req,res)=>res.json(await saveOutingRoute(pool,req.params.id,req.body,req.user,req.requestId)));
 return r;
}
