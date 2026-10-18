import {Router} from 'express';
import {csrfGuard} from '../identity/http.mjs';
import {createNewcomersService} from './service.mjs';
import {createCoffeeService} from './coffee.mjs';
import {createIntegrationAttendance} from './attendance.mjs';
export function newcomersRouter(pool){
 const r=Router(),s=createNewcomersService(pool),c=createCoffeeService(pool),a=createIntegrationAttendance(pool),ctx=req=>({user:req.user,requestId:req.requestId});
 r.get('/',async(req,res)=>res.json(await s.list(req.query,ctx(req))));
 r.post('/',csrfGuard,async(req,res)=>res.status(201).json(await s.save(req.body,ctx(req))));
 r.get('/coffees',async(req,res)=>res.json(await c.list(req.query,ctx(req))));
 r.post('/coffees',csrfGuard,async(req,res)=>res.status(201).json(await c.save(null,req.body,ctx(req))));
 r.get('/coffees/:id',async(req,res)=>res.json(await c.detail(req.params.id,req.query,ctx(req))));
 r.post('/coffees/:id',csrfGuard,async(req,res)=>res.json(await c.save(req.params.id,req.body,ctx(req))));
 r.post('/coffees/:id/guests',csrfGuard,async(req,res)=>res.json(await c.guest(req.params.id,req.body,ctx(req))));
 r.get('/meetings/:id',async(req,res)=>res.json(await a.roster(req.params.id,ctx(req))));
 r.post('/meetings/:id',csrfGuard,async(req,res)=>res.json(await a.save(req.params.id,req.body,ctx(req))));
 r.get('/:id',async(req,res)=>res.json(await s.detail(req.params.id,req.query,ctx(req))));
 r.post('/:id',csrfGuard,async(req,res)=>res.json(await s.save(req.body,ctx(req),req.params.id)));
 r.post('/:id/actions',csrfGuard,async(req,res)=>res.json(await s.action(req.params.id,req.body,ctx(req))));
 r.get('/:id/recommendations',async(req,res)=>res.json(await s.recommendations(req.params.id,req.query,ctx(req))));
 r.post('/:id/referral',csrfGuard,async(req,res)=>res.json(await s.refer(req.params.id,req.body,ctx(req))));
 r.post('/:id/convert',csrfGuard,async(req,res)=>res.json(await s.convert(req.params.id,req.body,ctx(req))));
 return r;
}
