import {DomainError} from '../core/errors.mjs';
export const validCoordinates='latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180';
export const confirmedCoordinates=`(${validCoordinates}) AND "coordinateStatus"='VERIFIED'`;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function territoryFilters(q,scope){
 const allowed=['q','country','province','municipality','locality','zone','sector','gender','ageMin','ageMax','status','location','page','focus','analysis'];
 if(Object.entries(q).some(([k,v])=>!allowed.includes(k)||typeof v!=='string'||v.length>100)||
 ['focus','zone','sector'].some(k=>q[k]&&!uuid.test(q[k]))||q.analysis&&q.analysis!=='true'||
 q.gender&&!['F','M'].includes(q.gender)||q.status&&!['ACTIVE','CLOSED','ALL'].includes(q.status)||
 q.location&&!['valid','missing','verified','pending'].includes(q.location)||
 ['ageMin','ageMax'].some(k=>q[k]!==undefined&&!/^\d{1,3}$/.test(q[k]))||
 q.ageMin!==undefined&&q.ageMax!==undefined&&Number(q.ageMin)>Number(q.ageMax)||
 q.page!==undefined&&(!/^\d{1,6}$/.test(q.page)||Number(q.page)<1))throw new DomainError(422,'Revisá los filtros del mapa.');
 const values=[scope.all,scope.ids],where=['($1 OR id=ANY($2::uuid[]))'],bind=value=>{values.push(value);return '$'+values.length;};
 if(q.status!=='ALL')where.push(`status=${bind(q.status||'ACTIVE')}`);
 const like=value=>'%'+value.trim().replace(/[\\%_]/g,'\\$&')+'%';
 if(q.q)where.push(`"displayCode" ILIKE ${bind(like(q.q))}`);
 for(const key of ['country','province','municipality','locality'])if(q[key])where.push(`"${key}" ILIKE ${bind(like(q[key]))}`);
 if(q.gender)where.push(`gender=${bind(q.gender)}`);
 if(q.ageMin!==undefined)where.push(`("ageUnrestricted" IS TRUE OR "recommendedAgeMax" IS NULL OR "recommendedAgeMax">=${bind(Number(q.ageMin))})`);
 if(q.ageMax!==undefined)where.push(`("ageUnrestricted" IS TRUE OR "recommendedAgeMin" IS NULL OR "recommendedAgeMin"<=${bind(Number(q.ageMax))})`);
 if(q.ageMin!==undefined||q.ageMax!==undefined)where.push('("ageUnrestricted" IS TRUE OR "recommendedAgeMin" IS NOT NULL OR "recommendedAgeMax" IS NOT NULL)');
 if(q.location==='valid')where.push(`(${validCoordinates})`);
 if(q.location==='missing')where.push(`NOT (${validCoordinates})`);
 if(q.location==='verified')where.push(`(${validCoordinates}) AND "coordinateStatus"='VERIFIED'`);
 if(q.location==='pending')where.push(`(${validCoordinates}) AND "coordinateStatus" IS DISTINCT FROM 'VERIFIED'`);
 for(const [key,level] of [['zone','ZONE'],['sector','SECTOR']])if(q[key])where.push(`id IN (SELECT ct.cell_id FROM cell_territory ct JOIN territory_units u ON u.id=ct.unit_id WHERE ${level==='ZONE'?'(u.id='+bind(q[key])+' OR u.parent_id='+bind(q[key])+')':'u.id='+bind(q[key])} AND ${level==='ZONE'?"(u.level='ZONE' OR u.level='SECTOR')":"u.level='SECTOR'"})`);
 return {values,where,bind};
}
