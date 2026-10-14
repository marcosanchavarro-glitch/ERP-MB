import {Router} from 'express';
import {csrfGuard} from '../identity/http.mjs';
import {requirePermission} from '../identity/authorization.mjs';
import {fail} from '../meetings/policy.mjs';
export function followupRouter(service){const r=Router(),ctx=req=>({user:req.user,requestId:req.requestId});
 r.use((req,res,next)=>{requirePermission(req.user,'seguimiento.ver');if(Object.values(req.query).some(v=>typeof v!=='string'||v.length>100))fail('Filtros inválidos.');next();});
 r.get('/',async(req,res)=>res.json(await service.list(req.query,ctx(req))));
 r.get('/person/:id',async(req,res)=>res.json(await service.person(req.params.id,ctx(req),req.query)));
 r.post('/cases',csrfGuard,async(req,res)=>res.status(201).json(await service.open(req.body,ctx(req))));
 r.get('/cases/:id',async(req,res)=>res.json(await service.detail(req.params.id,req.query,ctx(req))));
 r.post('/cases/:id/actions',csrfGuard,async(req,res)=>res.json(await service.action(req.params.id,req.body,ctx(req))));return r;
}
