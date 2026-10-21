import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,account,testServer,httpClient} from './helpers.mjs';
import {createCellsService} from '../server/cells/service.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {publicUser} from '../server/identity/presentation.mjs';
import {createUser} from '../server/identity/service.mjs';
import {blankCell} from '../src/domain/cell.js';
import {coverageRing,mappable,validLocation} from '../src/territory/geometry.js';
import {tileProvider} from '../server/territory/provider.mjs';
async function setup(t){const f=await fixture();t.after(()=>f.close());const user=await account(f),ctx={user:await principal(f.pool,user.id)},cells=createCellsService(f.pool),server=await testServer(f),client=httpClient(server.base);t.after(()=>server.close());await client.login(user);
 const cell=extra=>cells.save({cell:{...blankCell(),groupCode:'T',openedDate:'2026-01-01',...extra}},ctx);
 return {f,user,ctx,cells,server,client,cell};}

test('Mapa: circunferencia geográfica en metros, no píxeles; polos y datos inválidos',()=>{
 const c={latitude:-34.6,longitude:-58.4,coverageRadiusMeters:1000},ring=coverageRing(c);assert.equal(ring.length,96);
 const rad=Math.PI/180;for(const [lat,lng] of ring){const a=Math.sin((lat-c.latitude)*rad/2)**2+Math.cos(lat*rad)*Math.cos(c.latitude*rad)*Math.sin((lng-c.longitude)*rad/2)**2;const distance=6371008.8*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));assert.ok(Math.abs(distance-1000)<0.001);}
 for(const extra of [{coverageRadiusMeters:null},{coverageRadiusMeters:0},{coverageRadiusMeters:Infinity},{latitude:NaN},{latitude:null},{longitude:181}])assert.deepEqual(coverageRing({...c,...extra}),[]);
 assert.equal(validLocation({...c,latitude:90}),true);assert.equal(mappable({...c,latitude:90}),false);assert.deepEqual(coverageRing({...c,latitude:90}),[]);
 const dateline=coverageRing({...c,longitude:179.999});assert.ok(Math.max(...dateline.map(p=>p[1]))-Math.min(...dateline.map(p=>p[1]))<1);
});

test('Mapa: configuración pública sin secretos, atribución obligatoria y HTTPS',()=>{
 const p=tileProvider({});assert.equal(p.origin,'https://tile.openstreetmap.org');assert.ok(p.attribution.includes('OpenStreetMap'));
 for(const url of ['http://tiles.example/{z}/{x}/{y}.png','https://secret@tiles.example/{z}/{x}/{y}.png','https://tiles.example/{z}/{x}/{y}.png?key=secret','https://tiles.example/a.png'])assert.throws(()=>tileProvider({TERRITORY_TILE_URL:url}));
 assert.throws(()=>tileProvider({TERRITORY_TILE_URL:'https://tiles.example/{z}/{x}/{y}.png'}));
});

test('Mapa: consulta protegida, proyección mínima y filtros combinados de datos reales',async t=>{
 const x=await setup(t);await x.cell({locality:'Zona norte',latitude:-34.6,longitude:-58.4,coordinateStatus:'VERIFIED',coverageRadiusMeters:750,recommendedAgeMin:18,recommendedAgeMax:30,address:'PRIVATE-ADDRESS',notes:'PRIVATE-NOTES'});
 await x.cell({generation:2,gender:'M',locality:'Zona sur',latitude:0,longitude:0,ageUnrestricted:true});
 await x.cell({generation:3,gender:'F',locality:'Zona norte'});
 await x.cell({generation:4,gender:'M',locality:'Zona norte',recommendedAgeMin:60});
 let r=await x.client.request('/api/territory/cells'),d=await r.json();assert.equal(r.status,200);assert.equal(d.total,4);assert.equal(d.missingLocation,2);assert.ok(!JSON.stringify(d).includes('PRIVATE'));assert.ok(d.items.every(c=>!('address' in c)&&!('notes' in c)&&!('birthDate' in c)));
 r=await x.client.request('/api/territory/cells?q=T1&locality=norte&gender=F&ageMin=20&ageMax=25&location=verified');d=await r.json();assert.equal(d.total,1);assert.equal(d.items[0].coverageRadiusMeters,750);assert.equal(d.items[0].latitude,-34.6);
 d=await (await x.client.request('/api/territory/cells?gender=M&ageMin=25&ageMax=40')).json();assert.equal(d.total,1);assert.equal(d.items[0].ageUnrestricted,true);
 d=await (await x.client.request('/api/territory/cells?gender=M&ageMin=70')).json();assert.equal(d.total,2);
 d=await (await x.client.request('/api/territory/cells?location=missing')).json();assert.equal(d.total,2);assert.ok(d.items.every(c=>c.latitude===null&&c.longitude===null));
 assert.equal((await (await x.client.request('/api/territory/cells?location=pending')).json()).total,1);
 assert.equal((await (await x.client.request('/api/territory/cells?q=%25')).json()).total,0);
 for(const q of ['gender=X','ageMin=-1','ageMin=30&ageMax=20','latitude=1','page=0','location=exact','q=a&q=b'])assert.equal((await x.client.request('/api/territory/cells?'+q)).status,422,q);
 const anonymous=httpClient(x.server.base);assert.equal((await anonymous.request('/api/territory/cells')).status,401);
 const csp=r.headers.get('content-security-policy');assert.ok(csp.includes('https://tile.openstreetmap.org'));assert.ok(!csp.includes('unsafe-eval'));assert.equal(r.headers.get('referrer-policy'),'no-referrer');
 assert.equal((await fetch(x.server.base+'/vendor/leaflet/leaflet-src.esm.js')).status,200);assert.equal((await fetch(x.server.base+'/vendor/leaflet/package.json')).status,404);
});

test('Mapa: no amplía permisos, limita por célula, HDR sin habilitación y revocación inmediata',async t=>{
 const x=await setup(t),a=await x.cell({latitude:-34.6,longitude:-58.4}),b=await x.cell({generation:2,latitude:-35,longitude:-59});
 async function reader(permissions,grants){const password=randomUUID()+randomUUID(),user=await createUser(x.f.pool,{username:'map.'+randomUUID(),password});for(const g of grants(randomUUID()))for(const p of permissions){if(p==='modulos.acceder'&&!['global','area','subarea'].includes(g.scopeType)||p==='celulas.ver'&&!['global','cell'].includes(g.scopeType))continue;await x.f.pool.query('INSERT INTO user_permissions(id,user_id,permission,scope_type,scope_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),user.id,p,g.scopeType,g.scopeId||null]);}const client=httpClient(x.server.base);await client.login({...user,password});return {user,client};}
 const limited=await reader(['celulas.ver','modulos.acceder'],roleId=>[{roleId,scopeType:'cell',scopeId:a.id},{roleId,scopeType:'subarea',scopeId:'territorio-mapa'}]);
 let d=await (await limited.client.request('/api/territory/cells')).json();assert.deepEqual(d.items.map(c=>c.id),[a.id]);assert.ok(!JSON.stringify(d).includes(b.id));
 assert.equal((await limited.client.request('/api/cells/'+a.id,{method:'PUT',body:JSON.stringify({})})).status,403);
 const mapOnly=await reader(['modulos.acceder'],roleId=>[{roleId,scopeType:'subarea',scopeId:'territorio-mapa'}]);assert.equal((await mapOnly.client.request('/api/territory/cells')).status,403);assert.ok(!publicUser(await principal(x.f.pool,mapOnly.user.id)).access.paths.some(p=>p.path==='/territorio/mapa'));
 const hdr=await reader(['modulos.acceder','celulas.ver'],roleId=>[{roleId,scopeType:'area',scopeId:'hdr'}]);await x.f.pool.query("INSERT INTO user_permissions(id,user_id,permission,scope_type) VALUES($1,$2,'celulas.ver','global')",[randomUUID(),hdr.user.id]);assert.equal((await hdr.client.request('/api/territory/cells')).status,403);
 const cellsOnly=await reader(['celulas.ver'],roleId=>[{roleId,scopeType:'global'}]);assert.equal((await cellsOnly.client.request('/api/territory/cells')).status,403);
 await x.f.pool.query('DELETE FROM user_permissions WHERE user_id=$1 AND scope_type=\'subarea\'',[limited.user.id]);assert.equal((await limited.client.request('/api/territory/cells')).status,403);
});

test('Mapa: paginación SQL acotada, orden estable y ninguna geometría inventada',async t=>{
 const x=await setup(t);await x.f.pool.query(`INSERT INTO cells(id,"groupCode",generation,gender,"openedDate","lastEffectiveDate") SELECT gen_random_uuid(),'P',n,'M','2026-01-01','2026-01-01' FROM generate_series(1,1005) n`);
 const first=await (await x.client.request('/api/territory/cells')).json(),last=await (await x.client.request('/api/territory/cells?page=3')).json();assert.equal(first.items.length,500);assert.equal(last.items.length,5);assert.equal(last.pages,3);assert.equal(first.missingLocation,1005);assert.ok(first.items.every(c=>c.latitude===null&&c.longitude===null&&c.coverageRadiusMeters===null));assert.equal(last.items[0].displayCode,'P1001 M');
});
