import {Router} from 'express';
export function officeRouter(service){const r=Router();
 r.get('/birthdays',async(req,res)=>res.json(await service.birthdays(req.query,req.user)));
 r.get('/quality/people',async(req,res)=>res.json(await service.people(req.query,req.user)));
 r.get('/quality/cells',async(req,res)=>res.json(await service.cells(req.query,req.user)));
 return r;
}
