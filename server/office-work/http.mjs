import {Router} from 'express';
import {csrfGuard} from '../identity/http.mjs';
import {createOfficeWorkService} from './service.mjs';
import {createMonthlyService} from './monthly.mjs';
export function officeWorkRouter(pool,options){const r=Router(),s=createOfficeWorkService(pool,options),m=createMonthlyService(pool,options),ctx=req=>({user:req.user,requestId:req.requestId});
 r.get('/personal',async(req,res)=>res.json(await s.personal(req.query,ctx(req))));
 r.post('/claim',csrfGuard,async(req,res)=>res.json(await s.claim(req.body,ctx(req))));
 r.post('/contacts',csrfGuard,async(req,res)=>res.status(201).json(await s.save(req.body,ctx(req))));
 r.post('/contacts/:id',csrfGuard,async(req,res)=>res.json(await s.correct(req.params.id,req.body,ctx(req))));
 r.get('/people/:id',async(req,res)=>res.json(await s.history(req.params.id,req.query,ctx(req))));
 r.get('/monthly',async(req,res)=>res.json(await m.monthly(req.query,ctx(req))));
 r.get('/overview',async(req,res)=>res.json(await m.overview(req.query,ctx(req))));
 r.get('/settings',async(req,res)=>res.json(await s.settings(req.query,ctx(req))));
 r.post('/settings/:id',csrfGuard,async(req,res)=>res.json(await s.saveSettings(req.params.id,req.body,ctx(req))));
 return r;
}
