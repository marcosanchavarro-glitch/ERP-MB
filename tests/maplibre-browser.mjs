import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fixture,account,testServer} from './helpers.mjs';
import {createCellsService} from '../server/cells/service.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {blankCell} from '../src/domain/cell.js';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const f=await fixture(),user=await account(f),ctx={user:await principal(f.pool,user.id)},cells=createCellsService(f.pool);
const server=await testServer(f,{config:{territoryEnv:{GEOAPIFY_MAPS_BROWSER_KEY:'test-public-browser-key-00000000'}}});
await cells.save({cell:{...blankCell(),groupCode:'V',locality:'Zona de prueba',latitude:-34.802,longitude:-58.601,coordinateStatus:'VERIFIED',coverageRadiusMeters:800}},ctx);
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.setDefaultTimeout(18000);
let failStyles=false;const errors=[],styles=[],google=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('maps.googleapis.com'))google.push(r.url());});
// Actual self-hosted MapLibre, WebGL, worker and GeoJSON rendering. Only provider data is simulated.
await page.route('**/vendor/maplibre/maplibre-gl.mjs',route=>route.fulfill({contentType:'text/javascript',body:`export * from '/vendor/maplibre/maplibre-gl.mjs?actual';import * as Real from '/vendor/maplibre/maplibre-gl.mjs?actual';export class Map extends Real.Map{constructor(options){super(options);(window.__maps??=[]).push(this);}}`}));
await page.route('https://maps.geoapify.com/**',route=>{if(failStyles)return route.abort();styles.push(route.request().url());assert.equal(route.request().headers().referer,server.base+'/');return route.fulfill({contentType:'application/json',body:JSON.stringify({version:8,sources:{},layers:[{id:'fixture-background',type:'background',paint:{'background-color':route.request().url().includes('dark-matter')?'#26333b':'#f4eedf'}}]})});});
await page.route('https://tile.openstreetmap.org/**',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')}));
const goto=path=>page.goto(server.base+'/#'+path),settled=()=>page.waitForFunction(()=>document.querySelector('[data-territory-map]')?.dataset.mapEngine==='maplibre'&&document.querySelector('[data-territory-map-state]')?.hidden);
const view=()=>page.evaluate(()=>{const m=window.__maps.at(-1),p=m.getCenter();return {latitude:p.lat,longitude:p.lng,zoom:m.getZoom()};});
const explore=()=>page.evaluate(()=>window.__maps.at(-1).jumpTo({center:[-58.602,-34.801],zoom:15}));
const same=async p=>assert.deepEqual(await view(),p);
try{
 await mkdir('test-results/maplibre',{recursive:true});await goto('/territorio/mapa');await page.getByLabel('Usuario',{exact:true}).fill(user.username);await page.getByLabel('Contraseña',{exact:true}).fill(user.password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await settled();
 assert.equal(await page.getByRole('button',{name:'Volver a la sede'}).isEnabled(),false);assert.equal(await page.locator('.territory-site-marker').count(),0);await page.getByText('Sede central pendiente de confirmar.',{exact:false}).waitFor();assert.equal((await view()).zoom,10);
 // Coordinates are deliberately synthetic test fixtures, never the real institution's location.
 await f.pool.query("UPDATE institutional_sites SET latitude=-34.8,longitude=-58.6,\"coordinateStatus\"='VERIFIED'  WHERE id='central'");
 await goto('/oficina/personas');await page.locator('.territory-page').waitFor({state:'detached'});await goto('/territorio/mapa');await settled();await page.locator('.territory-site-marker').waitFor();assert.deepEqual(await view(),{latitude:-34.8,longitude:-58.6,zoom:16});
 const count=await page.evaluate(()=>window.__maps.length);assert.equal(await page.locator('.territory-site-badge img').count(),0);assert.equal(await page.locator('.territory-site-caption').innerText(),'Sede');assert.ok(await page.getByRole('button',{name:'Seleccionar V1 F',exact:true}).isVisible());
 await explore();const before=await view();await page.getByRole('button',{name:'Seleccionar V1 F',exact:true}).click();await same(before);await page.getByRole('button',{name:'Cerrar detalle',exact:true}).click();await same(before);
 await page.getByLabel('Mostrar coberturas',{exact:true}).check();await page.waitForFunction(async()=>{const source=window.__maps.at(-1).getSource('halo-coverage');return source&&(await source.getData()).features.length===1;});const ring=await page.evaluate(async()=>(await window.__maps.at(-1).getSource('halo-coverage').getData()).features[0].geometry.coordinates[0]);assert.equal(ring.length,97);assert.ok(Math.abs(ring[0][1]-(-34.802))>0.007);await same(before);
 await page.locator('.territory-filters summary').click();await page.getByLabel('Localidad',{exact:true}).fill('Zona');await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-territory-status]').textContent.includes('Cargando'));await same(before);
 await page.getByRole('button',{name:'Volver a la sede'}).focus();await page.keyboard.press('Enter');assert.deepEqual(await view(),{latitude:-34.8,longitude:-58.6,zoom:16});await explore();const stable=await view();
 for(const mode of ['light','dark']){
  await page.evaluate(mode=>{localStorage.setItem('erp.theme',mode);window.dispatchEvent(new StorageEvent('storage',{key:'erp.theme',newValue:mode}));},mode);await page.waitForFunction(mode=>document.querySelector('[data-territory-map]').dataset.mapStyle===(mode==='dark'?'dark-matter':'osm-bright'),mode);await page.waitForFunction(()=>window.__maps.at(-1).isStyleLoaded());await same(stable);
  assert.equal(await page.evaluate(()=>window.__maps.length),count);await page.waitForFunction(async()=>{const source=window.__maps.at(-1).getSource('halo-coverage');return source&&(await source.getData()).features.length===1;});
  for(const width of [320,360,390,430,768,1440]){await page.setViewportSize({width,height:1000});await same(stable);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`test-results/maplibre/${mode}-${width}-fixture.png`,fullPage:true});}
 }
 assert.equal(google.length,0);assert.equal(styles.length,3);assert.deepEqual(errors,[]);
 // Provider failure switches cartography while preserving camera, filter and selected detail.
 await page.getByRole('button',{name:'Seleccionar V1 F',exact:true}).click();failStyles=true;await page.evaluate(()=>document.documentElement.dataset.theme='light');await page.waitForFunction(()=>document.querySelector('[data-territory-map]')?.dataset.mapStyle==='raster-backup'&&document.querySelector('[data-territory-map-state]')?.hidden);await same(stable);assert.equal(await page.getByLabel('Localidad',{exact:true}).inputValue(),'Zona');await page.getByRole('heading',{name:'V1 F',exact:true}).waitFor();assert.equal(await page.locator('[data-territory-provider]').innerText(),'Cartografía de respaldo · Geoapify no está disponible.');
 // Revocation clears sensitive details and removes the map, even while a local filter is refreshed.
 await page.getByRole('button',{name:'Seleccionar V1 F',exact:true}).click();await f.pool.query('DELETE FROM user_roles WHERE user_id=$1',[user.id]);await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.getByText('Esta sección no está disponible.',{exact:true}).waitFor();assert.equal(await page.locator('.maplibregl-canvas').count(),0);assert.equal(await page.locator('[data-territory-detail]').innerText(),'');
 console.log('PASS real MapLibre/WebGL/worker: sede pendiente/verificada, centro zoom16, pines, radio800m, filtros/selección/teclado, mismo mapa y cámara en Light/Dark y 320/360/390/430/768/1440, limpieza al revocar acceso, cero Google. Datos cartográficos simulados; NO validación visual real de Geoapify.');
}finally{await browser.close();await server.close();await f.close();}
