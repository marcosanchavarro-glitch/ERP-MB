import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,account,testServer,httpClient} from './helpers.mjs';
import {tileProvider} from '../server/territory/provider.mjs';
const env={GEOAPIFY_MAPS_BROWSER_KEY:'test-public-browser-key-00000000',GEOAPIFY_API_KEY:'PRIVATE-GEOCODER-SENTINEL',GOOGLE_MAPS_BROWSER_KEY:'IGNORED-GOOGLE-SENTINEL'};
test('MapLibre: clave pública separada, estilos permitidos y respaldo sin Google',()=>{
 assert.deepEqual(tileProvider({}).geoapify,{configured:false});assert.equal(tileProvider(env).requested,'maplibre');
 const p=tileProvider(env);assert.ok(p.geoapify.light.includes('/osm-bright/'));assert.ok(p.geoapify.dark.includes('/dark-matter/'));assert.ok(!JSON.stringify(p).includes(env.GEOAPIFY_API_KEY));assert.ok(!JSON.stringify(p).includes(env.GOOGLE_MAPS_BROWSER_KEY));assert.ok(!('google' in p));
 assert.equal(tileProvider({GEOAPIFY_API_KEY:env.GEOAPIFY_API_KEY}).geoapify.configured,false);assert.equal(tileProvider({GEOAPIFY_MAPS_BROWSER_KEY:'bad key'}).geoapify.configured,false);
 assert.ok(tileProvider({...env,GEOAPIFY_MAP_STYLE:'https://evil.example'}).geoapify.light.includes('/osm-bright/'));assert.ok(tileProvider({...env,GEOAPIFY_MAP_STYLE:'osm-bright'}).geoapify.light.includes('/osm-bright/'));
});
test('MapLibre: CSP acotada, worker local, DTO protegido, sin claves privadas ni Google',async t=>{
 const f=await fixture();t.after(()=>f.close());const server=await testServer(f,{config:{territoryEnv:env}}),client=httpClient(server.base),admin=await account(f),none=await account(f,[]);
 const response=await fetch(server.base+'/'),csp=response.headers.get('content-security-policy');assert.ok(csp.includes('https://maps.geoapify.com'));assert.ok(csp.includes("worker-src 'self'"));assert.ok(!csp.includes('googleapis.com/maps')&&!csp.includes('maps.googleapis.com')&&!csp.includes('unsafe-eval'));assert.equal(response.headers.get('referrer-policy'),'origin');
 for(const file of ['maplibre-gl.mjs','maplibre-gl-worker.mjs','maplibre-gl-shared.mjs','maplibre-gl.css'])assert.equal((await fetch(server.base+'/vendor/maplibre/'+file)).status,200);assert.equal((await fetch(server.base+'/vendor/maplibre/package.json')).status,404);
 assert.equal((await client.request('/api/territory/cells')).status,401);assert.equal((await client.request('/api/locations/settings')).status,401);await client.login(none);assert.equal((await client.request('/api/territory/cells')).status,403);assert.equal((await client.request('/api/locations/settings')).status,403);
 await client.login(admin);const data=await (await client.request('/api/territory/cells')).json(),settings=await (await client.request('/api/locations/settings')).json();assert.equal(data.provider.geoapify.configured,true);assert.equal(settings.provider.geoapify.configured,true);assert.ok(!JSON.stringify({data,settings}).includes(env.GEOAPIFY_API_KEY));assert.equal(data.central.latitude,null);
});
