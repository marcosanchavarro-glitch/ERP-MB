import {Router} from 'express';
import {csrfGuard} from '../identity/http.mjs';
import {createAppointmentsService} from './service.mjs';
export function appointmentsRouter(pool,options){const r=Router(),s=createAppointmentsService(pool,options),ctx=req=>({user:req.user,requestId:req.requestId});
 r.get('/',async(req,res)=>res.json(await s.list(req.query,ctx(req))));
 r.get('/recipients',async(req,res)=>res.json(await s.recipients(req.query,ctx(req))));
 r.post('/recipients',csrfGuard,async(req,res)=>res.status(201).json(await s.saveRecipient(null,req.body,ctx(req))));
 r.post('/recipients/:id',csrfGuard,async(req,res)=>res.json(await s.saveRecipient(req.params.id,req.body,ctx(req))));
 r.get('/candidates',async(req,res)=>res.json(await s.candidates(req.query,ctx(req))));
 r.get('/:id',async(req,res)=>res.json(await s.detail(req.params.id,req.query,ctx(req))));
 r.post('/',csrfGuard,async(req,res)=>res.status(201).json(await s.save(null,req.body,ctx(req))));
 r.post('/:id',csrfGuard,async(req,res)=>res.json(await s.save(req.params.id,req.body,ctx(req))));
 return r;
}
