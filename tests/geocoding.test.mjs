import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {fixture,account,testServer,httpClient} from './helpers.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {createCellsService} from '../server/cells/service.mjs';
import {blankCell,cellFields} from '../src/domain/cell.js';
import {createGeocoder,candidatesFrom,addressKey,referenceView} from '../server/territory/geocoding.mjs';
const address={address:'Calle Prueba 123',locality:'Localidad de prueba',province:'Buenos Aires',country:'Argentina'};
const result={lat:-34.7,lon:-58.7,formatted:'Calle Prueba 123, Localidad de prueba',street:'Calle Prueba',housenumber:'123',city:address.locality,result_type:'building',rank:{confidence_street_level:1,confidence_building_level:1}};
const editable=c=>Object.fromEntries(cellFields.map(f=>[f.key,c[f.key]]));
async function setup(t,geocoding){const f=await fixture();t.after(()=>f.close());const user=await account(f),ctx={user:await principal(f.pool,user.id)},cells=createCellsService(f.pool),server=await testServer(f,{config:{geocoding}}),client=httpClient(server.base);await client.login(user);const cell=await cells.save({cell:{...blankCell(),groupCode:'G',...address}},ctx);return {f,user,ctx,cells,server,client,cell};}
test('Geocodificación: precisión conservadora, direcciones normalizadas y referencia sin marcador',()=>{
 assert.equal(addressKey(address),addressKey({...address,address:'  CALLE   PRUEBA 123  '}));
 const c=candidatesFrom([result,{...result,housenumber:'12'},{...result,street:null,result_type:'city'},{...result,lat:91}],address);assert.deepEqual(c.map(c=>c.accuracy),['EXACT','STREET','LOCALITY']);assert.equal(candidatesFrom([{...result,city:'Otra ciudad'}],address)[0].accuracy,'STREET');assert.deepEqual(candidatesFrom([],address),[]);
 assert.equal(referenceView({}).zoom,10);assert.throws(()=>referenceView({TERRITORY_REFERENCE_LATITUDE:91}));assert.throws(()=>addressKey({...address,locality:''}));
});
test('Geocodificación: búsqueda explícita, candidatos, caché concurrente, confirmación, corrección y auditoría',async t=>{
 let calls=0,query;const x=await setup(t,{env:{GEOAPIFY_API_KEY:'test-key'},fetchImpl:async url=>{calls++;query=new URL(url);return {ok:true,json:async()=>({results:[result,{...result,lat:-34.71,housenumber:'12'}]})};}});
 const search=()=>x.client.request('/api/locations/search/cell/'+x.cell.id,{method:'POST',body:JSON.stringify(address)});
 const [a,b]=await Promise.all([search(),search()]);assert.equal(a.status,200);assert.equal(b.status,200);const d=await a.json();assert.equal(calls,1);assert.equal(d.candidates.length,2);assert.equal(query.searchParams.get('housenumber'),'123');assert.equal(query.searchParams.get('city'),address.locality);assert.equal(query.searchParams.get('filter'),'countrycode:ar');assert.equal((await x.cells.get(x.cell.id)).latitude,null);
 let saved=await x.cells.save({cell:{...editable(x.cell),latitude:-34.7,longitude:-58.7},version:x.cell.version,locationConfirmation:{searchKey:d.searchKey,candidateIndex:0,manual:false}},{...x.ctx,id:x.cell.id});assert.equal(saved.coordinateStatus,'VERIFIED');assert.equal(saved.locationVerification.accuracy,'EXACT');assert.equal(saved.locationVerification.confirmedBy,x.user.id);
 await assert.rejects(()=>x.cells.save({cell:{...editable(saved),latitude:-34.8},version:saved.version,locationConfirmation:{searchKey:d.searchKey,candidateIndex:0,manual:false}},{...x.ctx,id:saved.id}),/ajuste manual/);
 saved=await x.cells.save({cell:{...editable(saved),latitude:-34.8},version:saved.version,locationConfirmation:{searchKey:d.searchKey,candidateIndex:1,manual:true}},{...x.ctx,id:saved.id});assert.equal(saved.locationVerification.accuracy,'MANUAL');assert.equal(saved.latitude,-34.8);
 saved=await x.cells.save({cell:{...editable(saved),address:'Otra calle 20'},version:saved.version},{...x.ctx,id:saved.id});assert.equal(saved.coordinateStatus,'PENDING');assert.equal(saved.locationVerification,null);
 await x.client.request('/api/territory/cells');await x.client.request('/api/territory/cells');assert.equal(calls,1,'Map GETs never geocode');
 const audit=(await x.f.pool.query("SELECT * FROM audit_events WHERE action='LOCATION_SEARCH'")).rows;assert.equal(audit.length,2);assert.ok(audit.every(a=>a.context.provider==='Geoapify'&&a.entity_id===x.cell.id));assert.ok(!JSON.stringify(audit).includes('test-key'));
});
test('Geocodificación: ausencia de clave, errores, no encontrados y cuotas persistentes',async t=>{
 const x=await setup(t,{env:{}}),context={user:x.ctx.user,entity:'CELL',entityId:x.cell.id};
 await assert.rejects(()=>createGeocoder(x.f.pool,{env:{}}).search(address,context),/no está configurada/);
 let calls=0;const geocoder=createGeocoder(x.f.pool,{env:{GEOAPIFY_API_KEY:'test',GEOCODING_DAILY_LIMIT:'2'},fetchImpl:async()=>{calls++;throw new Error('private-url-key');}});
 await assert.rejects(()=>geocoder.search(address,context),e=>e.status===503&&!e.message.includes('private-url-key'));
 await x.f.pool.query("UPDATE geocoding_usage SET last_request=now()-interval '1 second'");
 const empty=createGeocoder(x.f.pool,{env:{GEOAPIFY_API_KEY:'test',GEOCODING_DAILY_LIMIT:'2'},fetchImpl:async()=>({ok:true,json:async()=>({results:[]})})});assert.deepEqual((await empty.search(address,context)).candidates,[]);assert.equal((await empty.search(address,context)).cached,true);
 await assert.rejects(()=>empty.search({...address,address:'Otra calle 3'},context),e=>e.status===429);assert.equal(calls,1);
 const incomplete=await x.client.request('/api/locations/search/cell/'+x.cell.id,{method:'POST',body:JSON.stringify({...address,locality:''})});assert.equal(incomplete.status,422);
});
test('Sede: persistencia separada, pendiente sin coordenadas, confirmación manual y permisos backend',async t=>{
 const x=await setup(t,{env:{}}),anonymous=httpClient(x.server.base);assert.equal((await anonymous.request('/api/locations/central')).status,401);
 const viewer=await account(x.f,[]),limited=httpClient(x.server.base);await limited.login(viewer);assert.equal((await limited.request('/api/locations/central')).status,403);assert.equal((await limited.request('/api/locations/search/cell/'+x.cell.id,{method:'POST',body:JSON.stringify(address)})).status,403);
 let site=await (await x.client.request('/api/locations/central')).json();assert.equal(site.address,'Juan Manuel de Rosas 20251');assert.equal(site.latitude,null);assert.equal(site.coordinateStatus,null);
 const input=()=>Object.fromEntries(['institution','name','address','locality','province','country','latitude','longitude','version'].map(k=>[k,site[k]]));
 let r=await x.client.request('/api/locations/central',{method:'PUT',body:JSON.stringify({...input(),latitude:-34.8,longitude:-58.8})});assert.equal(r.status,200);site=await r.json();assert.equal(site.coordinateStatus,'PENDING');
 r=await x.client.request('/api/locations/central',{method:'PUT',body:JSON.stringify({...input(),confirmation:{manual:true}})});assert.equal(r.status,200);site=await r.json();assert.equal(site.coordinateStatus,'VERIFIED');assert.equal(site.verification.accuracy,'MANUAL');
 const dto=await (await x.client.request('/api/territory/cells')).json();assert.equal(dto.central.latitude,-34.8);assert.equal(dto.items.length,1);assert.equal(dto.items[0].latitude,null);assert.ok(!('verification' in dto.central));assert.equal(dto.reference.zoom,10);
 assert.equal((await x.f.pool.query("SELECT * FROM audit_events WHERE action='SITE_LOCATION_UPDATE'")).rowCount,2);
 assert.equal((await limited.request('/api/locations/central',{method:'PUT',body:JSON.stringify(input())})).status,403);
 assert.equal((await x.client.request('/api/locations/search/central/central',{method:'POST',body:JSON.stringify(site)})).status,422);
 const s=Object.fromEntries(Object.keys(address).map(k=>[k,site[k]]));assert.equal((await x.client.request('/api/locations/search/central/central',{method:'POST',body:JSON.stringify(s)})).status,503);
});
test('Ubicaciones: editor limitado a su célula, sin editar sede ni consultar otra dirección por ID',async t=>{
 const x=await setup(t,{env:{GEOAPIFY_API_KEY:'test-key'},fetchImpl:async()=>({ok:true,json:async()=>({results:[result]})})});
 const editor=await account(x.f,[]),client=httpClient(x.server.base);for(const permission of ['celulas.ver','celulas.editar'])await x.f.pool.query("INSERT INTO user_permissions(id,user_id,permission,scope_type,scope_id) VALUES($1,$2,$3,'cell',$4)",[randomUUID(),editor.id,permission,x.cell.id]);await x.f.pool.query("INSERT INTO user_permissions(id,user_id,permission,scope_type,scope_id) VALUES($1,$2,'modulos.acceder','subarea','territorio-mapa')",[randomUUID(),editor.id]);await client.login(editor);
 assert.equal((await client.request('/api/locations/settings')).status,200);
 assert.equal((await client.request('/api/locations/search/cell/'+x.cell.id,{method:'POST',body:JSON.stringify(address)})).status,200);
 assert.equal((await client.request('/api/locations/search/cell/'+randomUUID(),{method:'POST',body:JSON.stringify(address)})).status,404);
 assert.equal((await client.request('/api/locations/search/central/central',{method:'POST',body:JSON.stringify(address)})).status,403);
 const site=await (await client.request('/api/locations/central')).json();assert.equal(site.canManage,false);assert.ok(!('verification' in site));assert.equal((await client.request('/api/locations/central',{method:'PUT',body:'{}'})).status,403);
});
