import {Router} from 'express';
import {csrfGuard} from '../identity/http.mjs';
import {requirePermission} from '../identity/authorization.mjs';
import {fail} from '../meetings/policy.mjs';
export function leaderRouter(service){const router=Router(),ctx=req=>({user:req.user,requestId:req.requestId});
 router.use((req,res,next)=>{requirePermission(req.user,'lider.portal');if(Object.entries(req.query).some(([key,value])=>!['q','page','from','to'].includes(key)||typeof value!=='string'||value.length>100))fail('Filtros no válidos.');next();});
 router.get('/',async(req,res)=>res.json(await service.entry(ctx(req))));
 router.post('/cells/:cellId/prepare',csrfGuard,async(req,res)=>res.json(await service.prepare(req.params.cellId,req.body,ctx(req))));
 router.get('/cells/:cellId',async(req,res)=>res.json(await service.dashboard(req.params.cellId,ctx(req))));
 router.get('/cells/:cellId/members',async(req,res)=>res.json(await service.members(req.params.cellId,req.query,ctx(req))));
 router.get('/cells/:cellId/people/:id',async(req,res)=>res.json(await service.person(req.params.cellId,req.params.id,ctx(req))));
 router.get('/cells/:cellId/meetings',async(req,res)=>res.json(await service.history(req.params.cellId,req.query,ctx(req))));
 router.get('/cells/:cellId/meetings/:id/status',async(req,res)=>res.json(await service.status(req.params.cellId,req.params.id,ctx(req))));
 router.get('/cells/:cellId/meetings/:id',async(req,res)=>res.json(await service.meeting(req.params.cellId,req.params.id,ctx(req))));
 router.post('/cells/:cellId/meetings/:id/actions',csrfGuard,async(req,res)=>res.json(await service.action(req.params.cellId,req.params.id,req.body,ctx(req))));
 return router;
}
