import {candidates,assignBatch} from './batch.mjs';
import {Router} from 'express';
import {DomainError} from '../core/errors.mjs';
import {scopeFor,requirePermission,assertPerson} from '../identity/authorization.mjs';
import {csrfGuard} from '../identity/http.mjs';
import {validUuid} from '../../src/domain/cell.js';
import {cellAccess,cellCapabilities} from './service.mjs';
export function cellsRouter(cells,pool){
 const router=Router();
 router.use((req,res,next)=>{req.cellScope=requirePermission(req.user,'celulas.ver');next();});
 router.use((req,res,next)=>{const enums={status:['ACTIVE','CLOSED'],gender:['F','M'],meetingDay:['0','1','2','3','4','5','6'],sort:['code','openedDate','locality'],direction:['asc','desc']};if(Object.entries(enums).some(([k,values])=>req.query[k]&&!values.includes(req.query[k]))||(req.query.groupCode&&!/^[A-Z]$/.test(req.query.groupCode)))throw new DomainError(422,'Seleccioná filtros válidos.');next();});
 router.use((req,res,next)=>{const allowed=['q','status','gender','groupCode','meetingDay','locality','sort','direction','page','pageSize'];if(Object.entries(req.query).some(([k,v])=>!allowed.includes(k)||typeof v!=='string'||v.length>150)||['page','pageSize'].some(k=>req.query[k]&&(!/^\d+$/.test(req.query[k])||Number(req.query[k])<1||Number(req.query[k])>1000000)))throw new DomainError(422,'Filtros no válidos.');next();});
 router.param('id',(req,res,next,id)=>{if(!validUuid(id))throw new DomainError(400,'Identificador inválido.');cellAccess(req.user,'celulas.ver',id);next();});
 router.get('/meta',(req,res)=>res.json({capabilities:cellCapabilities(req.user)}));
 router.get('/person/:personId',async(req,res)=>{if(!validUuid(req.params.personId))throw new DomainError(400,'Identificador inválido.');assertPerson(requirePermission(req.user,'personas.ver'),req.params.personId);res.json(await cells.personHistory(req.params.personId,req.query,req.cellScope));});
 router.get('/',async(req,res)=>res.json(await cells.list(req.query,req.cellScope)));
 router.get('/:id',async(req,res)=>res.json({...await cells.get(req.params.id),capabilities:cellCapabilities(req.user,req.params.id)}));
 router.get('/:id/candidates',async(req,res)=>res.json(await candidates(pool,req.params.id,req.query,{user:req.user})));
 router.post('/:id/members/batch',csrfGuard,async(req,res)=>res.json(await assignBatch(pool,req.params.id,req.body,{user:req.user,requestId:req.requestId})));
 router.get('/:id/members',async(req,res)=>res.json(await cells.members(req.params.id,req.query,scopeFor(req.user,'personas.ver'))));
 router.get('/:id/history',async(req,res)=>res.json(await cells.history(req.params.id,req.query,scopeFor(req.user,'personas.ver'),req.cellScope)));
 const context=req=>({user:req.user,requestId:req.requestId});
 router.post('/',csrfGuard,async(req,res)=>res.status(201).json(await cells.save(req.body,context(req))));
 router.put('/:id',csrfGuard,async(req,res)=>res.json(await cells.save(req.body,{...context(req),id:req.params.id})));
 router.post('/:id/movements',csrfGuard,async(req,res)=>res.json(await cells.move(req.params.id,req.body,context(req))));
 router.post('/:id/close',csrfGuard,async(req,res)=>res.json(await cells.close(req.params.id,req.body,context(req))));
 router.use((req,res,next)=>next(new DomainError(405,'Esta operación no está disponible.')));return router;
}
