import {Router} from 'express';
import {csrfGuard} from '../identity/http.mjs';
import {listDepartments,departmentSummary,departmentTeam,departmentCandidates,manageDepartmentTeam,listDepartmentActivities,departmentActivityDetail,saveDepartmentActivity,transitionDepartmentActivity} from './service.mjs';
export function departmentsRouter(pool){
 const r=Router();r.get('/units',async(req,res)=>res.json(await listDepartments(pool,req.user)));
 r.get('/activities',async(req,res)=>res.json(await listDepartmentActivities(pool,req.user,req.query)));
 r.get('/people/:personId/activities',async(req,res)=>res.json(await listDepartmentActivities(pool,req.user,req.query,req.params.personId)));
 r.get('/units/:unitId',async(req,res)=>res.json(await departmentSummary(pool,req.params.unitId,req.user,req.query)));
 r.get('/units/:unitId/team',async(req,res)=>res.json(await departmentTeam(pool,req.params.unitId,req.user,req.query)));
 r.get('/units/:unitId/candidates',async(req,res)=>res.json(await departmentCandidates(pool,req.params.unitId,req.user,req.query)));
 r.get('/units/:unitId/people',async(req,res)=>res.json(await departmentCandidates(pool,req.params.unitId,req.user,req.query,true)));
 r.post('/units/:unitId/team',csrfGuard,async(req,res)=>res.status(201).json(await manageDepartmentTeam(pool,req.params.unitId,req.user,req.body)));
 r.post('/units/:unitId/team/:assignmentId/change',csrfGuard,async(req,res)=>res.json(await manageDepartmentTeam(pool,req.params.unitId,req.user,req.body,req.params.assignmentId)));
 r.post('/units/:unitId/team/:assignmentId/end',csrfGuard,async(req,res)=>res.json(await manageDepartmentTeam(pool,req.params.unitId,req.user,req.body,req.params.assignmentId,true)));
 r.get('/units/:unitId/activities/:id',async(req,res)=>res.json(await departmentActivityDetail(pool,req.params.unitId,req.params.id,req.user,req.query)));
 r.post('/units/:unitId/activities',csrfGuard,async(req,res)=>res.status(201).json(await saveDepartmentActivity(pool,req.params.unitId,null,req.body,req.user)));
 r.put('/units/:unitId/activities/:id',csrfGuard,async(req,res)=>res.json(await saveDepartmentActivity(pool,req.params.unitId,req.params.id,req.body,req.user)));
 r.post('/units/:unitId/activities/:id/state',csrfGuard,async(req,res)=>res.json(await transitionDepartmentActivity(pool,req.params.unitId,req.params.id,req.body,req.user)));
 return r;
}
