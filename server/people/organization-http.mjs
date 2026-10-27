import {Router} from 'express';
import {csrfGuard} from '../identity/http.mjs';
import {listOrganizationalUnits,organizationalUnitDetail,saveOrganizationalUnit,personOrganization,assignOrganization,updateOrganizationAssignment} from './organization.mjs';
export function organizationRouter(pool){
 const router=Router();router.get('/units',async(req,res)=>res.json(await listOrganizationalUnits(pool,req.query,req.user)));
 router.post('/units',csrfGuard,async(req,res)=>res.status(201).json(await saveOrganizationalUnit(pool,null,req.body,req.user)));
 router.get('/units/:unitId',async(req,res)=>res.json(await organizationalUnitDetail(pool,req.params.unitId,req.user,req.query)));
 router.put('/units/:unitId',csrfGuard,async(req,res)=>res.json(await saveOrganizationalUnit(pool,req.params.unitId,req.body,req.user)));
 return router;
}
export function personOrganizationRoutes(router,pool){
 router.get('/:id/organization',async(req,res)=>res.json(await personOrganization(pool,req.params.id,req.user,req.query)));
 router.post('/:id/organization',csrfGuard,async(req,res)=>res.status(201).json(await assignOrganization(pool,req.params.id,req.body,req.user)));
 router.post('/:id/organization/:assignmentId/change',csrfGuard,async(req,res)=>res.json(await updateOrganizationAssignment(pool,req.params.id,req.params.assignmentId,req.body,req.user)));
 router.post('/:id/organization/:assignmentId/end',csrfGuard,async(req,res)=>res.json(await updateOrganizationAssignment(pool,req.params.id,req.params.assignmentId,req.body,req.user,true)));
}
