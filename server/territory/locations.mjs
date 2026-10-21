import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import {csrfGuard} from '../identity/http.mjs';
import {adminAccess} from '../identity/admin-policy.mjs';
import {scopeFor} from '../identity/authorization.mjs';
import {cellAccess,uuid,shape,version,active} from '../cells/policy.mjs';
import {transaction} from '../db/pool.mjs';
import {appendAudit} from '../audit/repository.mjs';
import {DomainError} from '../core/errors.mjs';
import {territoryScope} from './policy.mjs';
import {createGeocoder,addressInput,locationConfirmation,referenceView,validPoint} from './geocoding.mjs';
export const centralSite=async db=>(await db.query("SELECT * FROM institutional_sites WHERE id='central'")).rows[0];
export function locationsRouter(pool,{provider,geocoder=createGeocoder(pool)}={}){
 const router=Router();
 const canManage=user=>scopeFor(user,'admin.usuarios.gestionar').all;
 const searchLimit=rateLimit({windowMs:60000,limit:10,standardHeaders:'draft-8',legacyHeaders:false,handler:(req,res,next)=>next(new DomainError(429,'Demasiadas búsquedas. Intentá en un momento.'))});
 router.get('/settings',(req,res)=>{if(!req.user)throw new DomainError(401,'Ingresá para continuar.');const edit=scopeFor(req.user,'celulas.editar'),create=scopeFor(req.user,'celulas.crear');if(!canManage(req.user)&&!edit.all&&!edit.ids.length&&!create.all)throw new DomainError(403,'Esta herramienta no está disponible.');res.json({configured:geocoder.configured,provider,reference:referenceView()});});
 router.get('/central',async(req,res)=>{territoryScope(req.user);const site=await centralSite(pool);if(!canManage(req.user))delete site.verification;res.json({...site,canManage:canManage(req.user)});});
 router.post('/search/:kind/:id',csrfGuard,searchLimit,async(req,res)=>{
  const {kind,id}=req.params;shape(req.body,['address','locality','province','country']);
  if(kind==='central'&&id==='central'){territoryScope(req.user);adminAccess(req.user,'gestionar');}
  else if(kind==='cell'){if(id==='new')cellAccess(req.user,'celulas.crear');else{uuid(id);cellAccess(req.user,'celulas.ver',id);cellAccess(req.user,'celulas.editar',id);const cell=(await pool.query('SELECT status FROM cells WHERE id=$1',[id])).rows[0];if(!cell)throw new DomainError(404,'No encontramos esta célula.');active(cell);}}
  else throw new DomainError(404,'Ubicación no disponible.');
  res.json(await geocoder.search(req.body,{user:req.user,entity:kind==='cell'?'CELL':'SITE',entityId:id==='new'?null:id,requestId:req.requestId}));
 });
 router.put('/central',csrfGuard,async(req,res)=>{
  territoryScope(req.user);adminAccess(req.user,'gestionar');shape(req.body,['institution','name','address','locality','province','country','latitude','longitude','version','confirmation']);
  const input=req.body,address=addressInput(input);for(const k of ['institution','name'])if(typeof input[k]!=='string'||!input[k].trim()||input[k].length>200||/[\u0000-\u001f]/.test(input[k]))throw new DomainError(422,'Revisá el nombre de la sede.');
  const result=await transaction(pool,async db=>{
   await db.query("SELECT id FROM institutional_sites WHERE id='central' FOR UPDATE");const old=await centralSite(db);version(old,input.version);
   const changed=['address','locality','province','country','latitude','longitude'].some(k=>(old[k]??null)!==(input[k]??null));
   const location={...address,latitude:input.latitude??null,longitude:input.longitude??null};
   if((location.latitude!=null||location.longitude!=null)&&!validPoint(location))throw new DomainError(422,'Revisá ambas coordenadas.');
   const verification=input.confirmation?await locationConfirmation(db,location,input.confirmation,req.user):changed?null:old.verification;
   const status=verification?'VERIFIED':location.latitude==null?null:'PENDING';
   await db.query('UPDATE institutional_sites SET institution=$1,name=$2,address=$3,locality=$4,province=$5,country=$6,latitude=$7,longitude=$8,"coordinateStatus"=$9,verification=$10,version=version+1 WHERE id=\'central\'',[input.institution.trim(),input.name.trim(),address.address,address.locality,address.province,address.country,location.latitude,location.longitude,status,verification]);
   const saved=await centralSite(db);await appendAudit(db,{actorId:req.user.id,action:'SITE_LOCATION_UPDATE',entity:'SITE',changes:[{field:'location',before:old,after:saved}],context:{requestId:req.requestId,siteId:'central'}});return saved;
  });res.json(result);
 });
 return router;
}
