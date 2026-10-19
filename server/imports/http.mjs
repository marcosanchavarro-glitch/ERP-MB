import {Router} from 'express';
import {csrfGuard} from '../identity/http.mjs';
import {createImportService} from './service.mjs';
export function importRouter(pool,options){const r=Router(),s=createImportService(pool,options),ctx=req=>({user:req.user,requestId:req.requestId});
 r.post('/parse',csrfGuard,async(req,res)=>res.json(await s.parse(req.body,ctx(req))));
 r.post('/preview',csrfGuard,async(req,res)=>res.json(await s.preview(req.body,ctx(req))));
 r.post('/confirm',csrfGuard,async(req,res)=>res.json(await s.confirm(req.body,ctx(req))));
 r.get('/',async(req,res)=>res.json(await s.history(req.query,ctx(req))));
 r.get('/:id',async(req,res)=>res.json(await s.report(req.params.id,ctx(req))));
 return r;
}
