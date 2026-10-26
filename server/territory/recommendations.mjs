import {createHash} from 'node:crypto';
import {DomainError} from '../core/errors.mjs';
import {requirePermission,assertPerson} from '../identity/authorization.mjs';
import {recommendationAccess,territoryScope} from './policy.mjs';
import {uuid,shape} from '../cells/policy.mjs';
import {transaction} from '../db/pool.mjs';
import {appendAudit} from '../audit/repository.mjs';
import {locationConfirmation,validPoint} from './geocoding.mjs';
import {birthdayInfo} from '../../src/domain/birthday.js';
import {installationToday} from '../core/calendar.mjs';

export const personAddressFingerprint=p=>createHash('sha256').update(JSON.stringify(['address','locality','municipality','province','postalCode'].map(k=>String(p[k]||'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ')))).digest('hex');
export const confirmedPersonLocation=p=>validPoint(p.geoLocation)&&p.geoLocation.verification&&p.geoLocation.addressFingerprint===personAddressFingerprint(p)?p.geoLocation:null;
export function recommendationScope(user,id,edit=false){
 uuid(id);assertPerson(requirePermission(user,'personas.ver'),id);
 if(!recommendationAccess(user,id,{edit}))throw new DomainError(403,'Esta herramienta no está disponible.');
 return territoryScope(user);
}
export async function recommendationPerson(db,id,{lock=false}={}){
 const p=(await db.query(`SELECT id,names,"lastNames","birthDate",sex,address,locality,municipality,province,"postalCode",version,"geoLocation" FROM people WHERE id=$1${lock?' FOR UPDATE':''}`,[id])).rows[0];
 if(!p)throw new DomainError(404,'No encontramos a esta persona.');return p;
}
export async function recommendCells(pool,id,user){
 const scope=recommendationScope(user,id);
 return transaction(pool,async db=>{
 const p=await recommendationPerson(db,id),location=confirmedPersonLocation(p),age=birthdayInfo(p.birthDate,installationToday())?.age??null,gender={HOMBRE:'M',MUJER:'F'}[p.sex]||null;
 // All scoring and limiting happen in SQL: no download of the cell dataset.
 const items=(await db.query(`WITH candidates AS (
 SELECT id,"displayCode",gender,locality,"recommendedAgeMin","recommendedAgeMax","ageUnrestricted",
 CASE WHEN "ageUnrestricted" OR ($3::int IS NOT NULL AND ("recommendedAgeMin" IS NOT NULL OR "recommendedAgeMax" IS NOT NULL) AND ("recommendedAgeMin" IS NULL OR $3>="recommendedAgeMin") AND ("recommendedAgeMax" IS NULL OR $3<="recommendedAgeMax")) THEN 0
 WHEN $3::int IS NULL OR ("recommendedAgeMin" IS NULL AND "recommendedAgeMax" IS NULL) THEN 1 ELSE 2 END AS "ageRank",
 (latitude BETWEEN -85.05112878 AND 85.05112878 AND longitude BETWEEN -180 AND 180 AND "coordinateStatus"='VERIFIED') IS TRUE AS "canMap",
 CASE WHEN $5::float8 IS NOT NULL AND latitude BETWEEN -85.05112878 AND 85.05112878 AND longitude BETWEEN -180 AND 180 AND "coordinateStatus"='VERIFIED'
 THEN 6371008.8 * 2 * asin(sqrt(least(1.0,greatest(0.0,power(sin(radians(latitude-$5)/2),2)+cos(radians($5))*cos(radians(latitude))*power(sin(radians(longitude-$6)/2),2))))) ELSE NULL END AS "distanceMeters"
 FROM cells WHERE ($1 OR id=ANY($2::uuid[])) AND status='ACTIVE' AND ($4::text IS NULL OR gender=$4)
 ) SELECT * FROM candidates ORDER BY "ageRank","distanceMeters" ASC NULLS LAST,"displayCode",id LIMIT 3`,[scope.all,scope.ids,age,gender,location?.latitude??null,location?.longitude??null])).rows.map(({ageRank,...c})=>({...c,ageCompatibility:['MATCH','UNKNOWN','ALTERNATIVE'][ageRank],genderCompatibility:gender?'MATCH':'UNKNOWN'}));
 return {person:{id:p.id,name:[p.names,p.lastNames].filter(Boolean).join(' '),age,sex:p.sex,address:p.address,locality:p.locality,province:p.province,version:p.version},location:location?{latitude:location.latitude,longitude:location.longitude,country:location.country}:null,canEditLocation:recommendationAccess(user,id,{edit:true}),items,referralAvailable:false};
 });
}
export async function savePersonLocation(pool,id,input,user,requestId){
 recommendationScope(user,id,true);shape(input,['latitude','longitude','country','version','confirmation']);
 if(!validPoint(input)||typeof input.country!=='string'||!input.country.trim()||input.country.length>100)throw new DomainError(422,'Revisá ambas coordenadas y el país.');
 return transaction(pool,async db=>{
 const p=await recommendationPerson(db,id,{lock:true});
 if(!Number.isInteger(input.version)||input.version!==p.version)throw new DomainError(409,'La ficha cambió. Volvé a consultar las recomendaciones antes de guardar.');
 if(!p.address||!p.locality||!p.province)throw new DomainError(422,'Completá dirección, localidad y provincia en la ficha antes de confirmar su ubicación.');
 const value={latitude:input.latitude,longitude:input.longitude,country:input.country.trim(),addressFingerprint:personAddressFingerprint(p),verification:await locationConfirmation(db,{...p,...input},input.confirmation,user)};
 await db.query('UPDATE people SET "geoLocation"=$2,version=version+1,"updatedAt"=now() WHERE id=$1',[id,value]);
 await appendAudit(db,{actorId:user.id,action:'PERSON_LOCATION_UPDATE',entity:'PERSON',entityId:id,changes:[{field:'geoLocation',before:p.geoLocation,after:value}],context:{requestId}});
 return {saved:true};
 });
}
