import {Router} from 'express';
import {csrfGuard} from '../identity/http.mjs';
import {requirePermission} from '../identity/authorization.mjs';
import {fail} from './policy.mjs';
export function meetingsRouter(service){const router=Router(),ctx=req=>({user:req.user,requestId:req.requestId});
 router.use((req,res,next)=>{requirePermission(req.user,'asistencia.ver');if(Object.entries(req.query).some(([k,v])=>!['from','to','cellId','page'].includes(k)||typeof v!=='string'||v.length>50))fail('Filtros no válidos.');next();});
 router.get('/',async(req,res)=>res.json(await service.list(req.query,ctx(req))));
 router.post('/generate',csrfGuard,async(req,res)=>res.json(await service.generate(req.body,ctx(req))));
 router.get('/person/:id',async(req,res)=>res.json(await service.person(req.params.id,req.query,ctx(req))));
 router.get('/matrix/:id',async(req,res)=>res.json(await service.matrix(req.params.id,req.query,ctx(req))));
 router.get('/:id',async(req,res)=>res.json(await service.detail(req.params.id,ctx(req))));
 router.get('/:id/history',async(req,res)=>res.json(await service.history(req.params.id,req.query,ctx(req))));
 router.post('/:id/actions',csrfGuard,async(req,res)=>res.json(await service.action(req.params.id,req.body,ctx(req))));
 return router;
}
