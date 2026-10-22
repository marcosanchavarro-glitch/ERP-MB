import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,account,testServer,httpClient} from './helpers.mjs';
import {tileProvider} from '../server/territory/provider.mjs';
const env={GOOGLE_MAPS_BROWSER_KEY:'test-google-browser-key-00000000',GOOGLE_MAPS_MAP_ID:'test-vector-map',GEOAPIFY_API_KEY:'PRIVATE-BACKEND-SENTINEL'};
test('Google: solo configuración de navegador válida, respaldo explícito sin clave/Map ID',()=>{
 assert.deepEqual(tileProvider({}).google,{configured:false});assert.deepEqual(tileProvider({GOOGLE_MAPS_BROWSER_KEY:env.GOOGLE_MAPS_BROWSER_KEY}).google,{configured:false});assert.deepEqual(tileProvider({GOOGLE_MAPS_MAP_ID:env.GOOGLE_MAPS_MAP_ID}).google,{configured:false});
 const provider=tileProvider(env);assert.equal(provider.google.configured,true);assert.equal(provider.google.apiKey,env.GOOGLE_MAPS_BROWSER_KEY);assert.equal(provider.google.mapId,env.GOOGLE_MAPS_MAP_ID);assert.ok(!JSON.stringify(provider).includes(env.GEOAPIFY_API_KEY));
 assert.equal(tileProvider({...env,GOOGLE_MAPS_MAP_ID:'<script>'}).google.configured,false);assert.equal(tileProvider({...env,GOOGLE_MAPS_BROWSER_KEY:'invalid key with spaces'}).google.configured,false);
});
test('Google: DTO protegido, CSP sin eval, nonce y referrer por origen; claves backend privadas',async t=>{
 const f=await fixture();t.after(()=>f.close());const server=await testServer(f,{config:{territoryEnv:env,geocoding:{env}}}),client=httpClient(server.base),admin=await account(f),none=await account(f,[]);
 const shell=await fetch(server.base+'/'),html=await shell.text(),csp=shell.headers.get('content-security-policy'),scriptPolicy=csp.split(';').find(s=>s.trim().startsWith('script-src'));
 assert.ok(csp.includes('https://maps.googleapis.com'));assert.ok(csp.includes('worker-src'));assert.ok(!scriptPolicy.includes('unsafe-eval')&&!scriptPolicy.includes('unsafe-inline'));const nonce=html.match(/nonce="([^"]+)"/)[1];assert.ok(csp.includes("'nonce-"+nonce+"'"));assert.equal(shell.headers.get('referrer-policy'),'origin');assert.ok(!html.includes(env.GOOGLE_MAPS_BROWSER_KEY)&&!html.includes(env.GEOAPIFY_API_KEY));
 assert.equal((await client.request('/api/territory/cells')).status,401);assert.equal((await client.request('/api/locations/settings')).status,401);await client.login(none);assert.equal((await client.request('/api/territory/cells')).status,403);assert.equal((await client.request('/api/locations/settings')).status,403);
 await client.login(admin);const data=await (await client.request('/api/territory/cells')).json(),settings=await (await client.request('/api/locations/settings')).json();assert.equal(data.provider.google.apiKey,env.GOOGLE_MAPS_BROWSER_KEY);assert.equal(settings.provider.google.mapId,env.GOOGLE_MAPS_MAP_ID);assert.ok(!JSON.stringify({data,settings}).includes(env.GEOAPIFY_API_KEY));assert.equal(data.items.length,0);assert.equal(data.central.latitude,null);
 const fallback=await testServer(f,{config:{territoryEnv:{}}}),response=await fetch(fallback.base+'/');assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.ok(!response.headers.get('content-security-policy').includes('maps.googleapis.com'));
});
