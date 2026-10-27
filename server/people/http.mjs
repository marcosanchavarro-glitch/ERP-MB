import {departmentScope} from '../departments/policy.mjs';
import {Router} from 'express';
import {DomainError} from '../core/errors.mjs';
import {requirePermission,assertPerson,capabilities,scopeFor} from '../identity/authorization.mjs';
import {csrfGuard} from '../identity/http.mjs';
import {recommendationAccess} from '../territory/policy.mjs';
import {officeCatalog,officeProfile,changeOffice,administrativeOffices} from './ecclesiastical.mjs';
import {organizationMeta} from './organization.mjs';
import {organizationRouter,personOrganizationRoutes} from './organization-http.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function peopleRouter(people,pool) {
 const router=Router();
 router.use((req,res,next)=>{req.readScope=requirePermission(req.user,'personas.ver');next();});
 router.param('id',(req,res,next,id)=>{if(!uuid.test(id))throw new DomainError(400,'El identificador de persona no es válido.');assertPerson(req.readScope,id);next();});
 router.get('/meta',async(req,res)=>res.json({localities:await people.localities(req.readScope),offices:await officeCatalog(pool),organization:await organizationMeta(pool,req.readScope,scopeFor(req.user,'personas.historial')),capabilities:capabilities(req.user),mode:'authenticated'}));
 router.use('/organization',organizationRouter(pool));personOrganizationRoutes(router,pool);
 router.get('/ecclesiastical-offices',async(req,res)=>res.json(await administrativeOffices(pool,req.user)));
 router.get('/:id/ecclesiastical-office',async(req,res)=>res.json(await officeProfile(pool,req.params.id,req.user,req.query.page||1)));
 router.post('/:id/ecclesiastical-office',csrfGuard,async(req,res)=>res.json(await changeOffice(pool,req.params.id,req.body,req.user,req.requestId)));
 router.get('/',async(req,res)=>{
  const allowed=['q','status','sex','locality','completeness','sort','direction','page','pageSize','office','organizationUnit','responsibility','participation'];
  if(Object.entries(req.query).some(([key,value])=>!allowed.includes(key)||typeof value!=='string'||value.length>200))throw new DomainError(422,'Filtros no válidos.');
  res.json(await people.list(req.query,{...req.readScope,organizationHistory:scopeFor(req.user,'personas.historial')}));
 });
 router.get('/:id',async(req,res)=>res.json({...await people.get(req.params.id),capabilities:{...capabilities(req.user,req.params.id),departments:Boolean(departmentScope(req.user).all||departmentScope(req.user).ids.length),recommendations:recommendationAccess(req.user,req.params.id)}}));
 router.get('/:id/history',async(req,res)=>{assertPerson(requirePermission(req.user,'personas.historial'),req.params.id);res.json(await people.history(req.params.id,req.query.page));});
 const save=async(req,res)=>{
  const id=req.params.id,scope=requirePermission(req.user,id?'personas.editar':'personas.crear');
  if(id)assertPerson(scope,id);else if(!scope.all)throw new DomainError(403,'No tenés permiso para crear personas.');
  const payload=req.body;
  if(!payload||Array.isArray(payload)||Object.keys(payload).some(key=>!['person','version','acknowledgeDuplicates'].includes(key))||(id&&(!Number.isInteger(payload.version)||payload.version<1))||(payload.acknowledgeDuplicates!==undefined&&typeof payload.acknowledgeDuplicates!=='boolean'))throw new DomainError(422,'Se enviaron campos no admitidos o una versión inválida.');
  const person=await people.save(payload.person,{id,version:payload.version,actorId:req.user.id,acknowledgeDuplicates:payload.acknowledgeDuplicates===true,readScope:req.readScope,requestId:req.requestId});
  res.status(id?200:201).json({...person,capabilities:capabilities(req.user,person.id)});
 };
 router.post('/',csrfGuard,save);router.put('/:id',csrfGuard,save);
 router.use((req,res,next)=>next(new DomainError(405,'Esta operación no está disponible.')));
 return router;
}
