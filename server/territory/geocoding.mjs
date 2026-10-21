import {createHash} from 'node:crypto';
import {DomainError} from '../core/errors.mjs';
import {appendAudit} from '../audit/repository.mjs';
import {shape} from '../cells/policy.mjs';
const fail=(message,status=422)=>{throw new DomainError(status,message);};
export const addressKeys=['address','locality','province','country'];
export function addressInput(input){
 const value={};for(const k of addressKeys){const text=input?.[k];if(typeof text!=='string'||!text.trim()||text.length>(k==='address'?200:100)||/[\u0000-\u001f]/.test(text))fail('Completá dirección, localidad, provincia y país.');value[k]=text.trim();}return value;
}
export const addressKey=input=>createHash('sha256').update(JSON.stringify(addressInput(input),(_,v)=>typeof v==='string'?v.normalize('NFKC').toLocaleLowerCase('es').replace(/\s+/g,' '):v)).digest('hex');
export function referenceView(env=process.env){
 const value={latitude:Number(env.TERRITORY_REFERENCE_LATITUDE??-34.8),longitude:Number(env.TERRITORY_REFERENCE_LONGITUDE??-58.6),zoom:Number(env.TERRITORY_REFERENCE_ZOOM??10),label:env.TERRITORY_REFERENCE_LABEL||'Buenos Aires · vista regional de referencia'};
 if(!validPoint(value)||!Number.isInteger(value.zoom)||value.zoom<2||value.zoom>18||value.label.length>150)throw new Error('Invalid territory reference viewport');return value;
}
export const validPoint=c=>typeof c?.latitude==='number'&&Number.isFinite(c.latitude)&&Math.abs(c.latitude)<=85.05112878&&typeof c.longitude==='number'&&Number.isFinite(c.longitude)&&Math.abs(c.longitude)<=180;
export function candidatesFrom(results,address){
 const normalized=s=>String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
 const height=address.address.match(/\s(\d+[a-z]?)$/i)?.[1];
 return (Array.isArray(results)?results:[]).slice(0,5).filter(p=>validPoint({latitude:p.lat,longitude:p.lon})).map(p=>({
  latitude:p.lat,longitude:p.lon,label:String(p.formatted||[p.street,p.housenumber,p.city].filter(Boolean).join(' ')).slice(0,500),
  accuracy:p.result_type==='building'&&height&&normalized(p.housenumber)===normalized(height)&&p.rank?.confidence_street_level>=0.9&&p.rank?.confidence_building_level>=0.9&&normalized(p.city||p.town||p.village)===normalized(address.locality)?'EXACT':p.street?'STREET':'LOCALITY',
  attribution:String(p.datasource?.attribution||'© OpenStreetMap contributors').slice(0,500),sourceLicense:String(p.datasource?.license||'').slice(0,200),sourceUrl:String(p.datasource?.url||'').slice(0,500),provider:'Geoapify'
 }));
}
export function createGeocoder(pool,{env=process.env,fetchImpl=fetch}={}){
 const key=env.GEOAPIFY_API_KEY,configured=Boolean(key),dailyLimit=Math.min(3000,Math.max(1,Number(env.GEOCODING_DAILY_LIMIT)||250));
 const usageDay="(now() AT TIME ZONE 'UTC')::date";
 async function search(input,{user,entity,entityId,requestId}){
  const address=addressInput(input),hash=addressKey(address),db=await pool.connect();let result,cached=false,providerError;
  try{await db.query('BEGIN');await db.query("SELECT pg_advisory_xact_lock(hashtext('halo-geocoding'))");
   const found=(await db.query('SELECT candidates FROM geocoding_cache WHERE key=$1',[hash])).rows[0];
   if(found){result=found.candidates;cached=true;}
   else{
    if(!configured)fail('La búsqueda de direcciones todavía no está configurada. Podés confirmar el punto manualmente.',503);
    await db.query(`INSERT INTO geocoding_usage(day) VALUES(${usageDay}) ON CONFLICT DO NOTHING`);
    const usage=(await db.query(`SELECT requests,extract(epoch FROM now()-last_request) AS elapsed FROM geocoding_usage WHERE day=${usageDay} FOR UPDATE`)).rows[0];
    if(usage.requests>=dailyLimit)fail('Se alcanzó el límite diario de búsquedas. Podés ubicar el punto manualmente.',429);
    if(usage.elapsed!=null&&Number(usage.elapsed)<0.25)fail('Esperá un momento antes de volver a buscar.',429);
    await db.query(`UPDATE geocoding_usage SET requests=requests+1,last_request=now() WHERE day=${usageDay}`);
    const url=new URL('https://api.geoapify.com/v1/geocode/search'),parts=address.address.match(/^(.*?)\s+(\d+[a-z]?)$/i);
    const params={street:parts?.[1]||address.address,...(parts?{housenumber:parts[2]}:{}),city:address.locality,state:address.province,country:address.country,bias:'countrycode:ar',lang:'es',limit:'5',format:'json',apiKey:key};
    if(/^(argentina|ar)$/i.test(address.country))params.filter='countrycode:ar';url.search=new URLSearchParams(params);
    try{const response=await fetchImpl(url,{signal:AbortSignal.timeout(6000),redirect:'error'});if(!response.ok)throw new Error('provider');const body=await response.json();if(!Array.isArray(body.results))throw new Error('provider');result=candidatesFrom(body.results,address);await db.query('INSERT INTO geocoding_cache(key,candidates) VALUES($1,$2)',[hash,JSON.stringify(result)]);}catch{providerError=true;}
   }
   await appendAudit(db,{actorId:user.id,action:'LOCATION_SEARCH',entity,entityId:entity==='SITE'?null:entityId,context:{requestId,recordId:entityId,provider:'Geoapify',addressKey:hash,cached,outcome:providerError?'UNAVAILABLE':result.length?'FOUND':'NOT_FOUND'}});
   await db.query('COMMIT');
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
  if(providerError)fail('El proveedor no respondió. Intentá más tarde o ubicá el punto manualmente.',503);
  return {searchKey:hash,candidates:result,cached};
 }
 return {configured,search};
}
// Confirmation is an explicit user action. Provider candidates never change persisted coordinates on search.
export async function locationConfirmation(db,location,input,user){
 shape(input,['searchKey','candidateIndex','manual']);if(typeof input.manual!=='boolean'||!validPoint(location))fail('Revisá y confirmá un punto válido en el mapa.');
 let candidate=null;
 if(input.searchKey!=null){if(input.searchKey!==addressKey(location))fail('La dirección cambió. Volvé a buscar o confirmá manualmente.');const row=(await db.query('SELECT candidates FROM geocoding_cache WHERE key=$1',[input.searchKey])).rows[0];candidate=Number.isInteger(input.candidateIndex)?row?.candidates[input.candidateIndex]:null;if(!candidate)fail('Elegí una ubicación de los resultados.');}
 if(!candidate&&!input.manual)fail('Confirmá el punto manualmente o elegí un resultado.');
 if(candidate&&!input.manual&&(location.latitude!==candidate.latitude||location.longitude!==candidate.longitude))fail('Confirmá el ajuste manual del punto.');
 return {provider:candidate?'Geoapify':'Manual',accuracy:input.manual?'MANUAL':candidate.accuracy,candidate,confirmedAt:new Date().toISOString(),confirmedBy:user.id};
}
