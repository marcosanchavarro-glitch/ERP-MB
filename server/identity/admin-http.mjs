import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import {csrfGuard} from './http.mjs';
import {adminAccess} from './admin-policy.mjs';
import {fail} from '../meetings/policy.mjs';
export function identityAdminRouter(service){const r=Router(),ctx=req=>({user:req.user,requestId:req.requestId});
 r.use((req,res,next)=>{adminAccess(req.user);if(Object.values(req.query).some(v=>typeof v!=='string'||v.length>100))fail('Consulta inválida.');next();});
 r.get('/catalog',async(req,res)=>res.json(await service.catalog(ctx(req))));
 r.get('/candidates',async(req,res)=>res.json(await service.candidates(req.query,ctx(req))));
 r.get('/person/:id',async(req,res)=>res.json(await service.byPerson(req.params.id,ctx(req))));
 r.get('/audit',async(req,res)=>res.json(await service.audit(null,req.query,ctx(req))));
 r.get('/',async(req,res)=>res.json(await service.list(req.query,ctx(req))));
 r.get('/:id',async(req,res)=>res.json(await service.get(req.params.id,ctx(req))));
 r.get('/:id/audit',async(req,res)=>res.json(await service.audit(req.params.id,req.query,ctx(req))));
 const sensitive=rateLimit({windowMs:60000,limit:20,keyGenerator:req=>req.user.id,standardHeaders:'draft-8',legacyHeaders:false,handler:()=>fail('Demasiadas operaciones de seguridad. Esperá un minuto.',429)});
 r.post('/',csrfGuard,sensitive,async(req,res)=>res.status(201).json(await service.create(req.body,ctx(req))));
 r.put('/:id',csrfGuard,sensitive,async(req,res)=>res.json(await service.update(req.params.id,req.body,ctx(req))));
 r.post('/:id/security',csrfGuard,sensitive,async(req,res)=>res.json(await service.security(req.params.id,req.body,ctx(req))));return r;
}
