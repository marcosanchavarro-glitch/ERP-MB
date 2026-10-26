import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fixture,account,testServer} from './helpers.mjs';
import {createCellsService} from '../server/cells/service.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {saveTerritorialUnit} from '../server/territory/organization.mjs';
import {blankCell} from '../src/domain/cell.js';
import {branding} from '../server/core/branding.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const f=await fixture(),user=await account(f),actor=await principal(f.pool,user.id),cells=createCellsService(f.pool);
let parent=null;for(const [level,name]of [['COUNTRY','Argentina'],['PROVINCE','Buenos Aires'],['MUNICIPALITY','La Matanza'],['LOCALITY','Virrey del Pino']])parent=await saveTerritorialUnit(f.pool,null,{level,name,parentId:parent?.id||null,geographyConfirmed:true},actor,'test-setup');
const make=extra=>cells.save({cell:{...blankCell(),groupCode:'B',openedDate:'2020-01-01',country:'Argentina',province:'Buenos Aires',municipality:'La Matanza',locality:'Virrey del Pino',latitude:-34.8,longitude:-58.6,coordinateStatus:'VERIFIED',coverageRadiusMeters:500,recommendedAgeMin:18,recommendedAgeMax:35,...extra}},{user:actor});
const c=await make({}),pending=await make({generation:2,coordinateStatus:'PENDING'}),closed=await make({generation:3});await f.pool.query(`UPDATE cells SET status='CLOSED',"closedDate"='2026-01-01' WHERE id=$1`,[closed.id]);
// Confirmed synthetic HQ only in this disposable database.
await f.pool.query(`UPDATE institutional_sites SET latitude=-34.8,longitude=-58.6,"coordinateStatus"='VERIFIED' WHERE id='central'`);
const server=await testServer(f,{config:{territoryEnv:{GEOAPIFY_MAPS_BROWSER_KEY:'test-public-browser-key-00000000'},branding:branding({APP_LOGO_PATH:'/src/assets/manantial-logo.png',APP_FAVICON_PATH:'/src/assets/manantial-logo.png'})}});
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.setDefaultTimeout(18000);
const errors=[],styles=[];page.on('pageerror',error=>errors.push(error.message));
await page.route('**/vendor/maplibre/maplibre-gl.mjs',route=>route.fulfill({contentType:'text/javascript',body:`export * from '/vendor/maplibre/maplibre-gl.mjs?actual';import * as Real from '/vendor/maplibre/maplibre-gl.mjs?actual';export class Map extends Real.Map{constructor(o){super(o);(window.__maps??=[]).push(this);}}`}));
await page.route('https://maps.geoapify.com/**',route=>{styles.push(route.request().url());return route.fulfill({contentType:'application/json',body:JSON.stringify({version:8,sources:{},layers:[{id:'fixture-background',type:'background',paint:{'background-color':'#f4eedf'}}]})});});
const view=()=>page.evaluate(()=>{const m=window.__maps.at(-1),p=m.getCenter();return [p.lng,p.lat,m.getZoom()];});
const metrics=()=>page.locator('.territory-metrics dd').allTextContents();
const selectMode=value=>page.getByLabel('Visualización',{exact:true}).selectOption(value);
const waitDensity=()=>page.waitForFunction(async()=>{const s=window.__maps.at(-1).getSource('halo-density');return s&&(await s.getData()).features.length===1;});
try{
 await mkdir('test-results/territory13',{recursive:true});await page.goto(server.base+'/#/territorio/analisis');await page.getByLabel('Usuario',{exact:true}).waitFor();assert.equal(await page.locator('.login-logo').count(),0);assert.equal(await page.locator('link[rel=icon]').getAttribute('href'),'/src/favicon.svg');
 await page.getByLabel('Usuario',{exact:true}).fill(user.username);await page.getByLabel('Contraseña',{exact:true}).fill(user.password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
 await page.locator('.territory-metrics').waitFor();await page.locator('.maplibregl-canvas').waitFor();await page.waitForFunction(()=>document.querySelector('[data-territory-map-state]').hidden);assert.equal((await metrics())[0],'2');assert.equal(await page.locator('.brand-mark img').count(),0);await page.locator('[data-territory-map] img[data-institutional-logo]').waitFor();
 const manager=page.locator('.territory-organization');await manager.locator('summary').click();const form=manager.locator('form');
 await form.getByLabel('Nivel',{exact:true}).selectOption('ZONE');await form.getByLabel('Nivel superior',{exact:true}).selectOption(parent.id);await form.getByLabel('Nombre',{exact:true}).fill('Zona de prueba UI');await form.getByRole('button',{name:'Guardar territorio',exact:true}).click();await manager.locator('[data-unit-edit] option').filter({hasText:'Zona de prueba UI'}).waitFor({state:'attached'});
 let zone=(await f.pool.query("SELECT id FROM territory_units WHERE name='Zona de prueba UI'")).rows[0];
 await form.getByLabel('Nivel',{exact:true}).selectOption('SECTOR');await form.getByLabel('Nivel superior',{exact:true}).selectOption(zone.id);await form.getByLabel('Nombre',{exact:true}).fill('Sector UI sin células');await form.getByRole('button',{name:'Guardar territorio',exact:true}).click();await page.locator('.territory-presence h3').filter({hasText:'Sector UI sin células'}).waitFor();
 await manager.locator('[data-unit-edit]').selectOption(zone.id);await form.getByLabel('Descripción',{exact:true}).fill('Descripción revisada');await form.getByRole('button',{name:'Guardar territorio',exact:true}).click();await page.waitForFunction(async()=>{const r=await fetch('/api/territory/units');return (await r.json()).items.some(u=>u.name==='Zona de prueba UI'&&u.description==='Descripción revisada');});
 await page.locator(`[data-territory-select="${c.id}"]`).click();const assignment=page.locator('[data-territory-assignment]');await assignment.getByLabel('Zona o sector',{exact:true}).selectOption(zone.id);await assignment.getByRole('button',{name:'Guardar asignación',exact:true}).click();await page.waitForFunction(id=>document.querySelector('[data-territory-assignment] select')?.value===id,zone.id);
 await page.getByRole('button',{name:'Cerrar detalle',exact:true}).click();await manager.locator('summary').click();
 await page.evaluate(()=>window.__maps.at(-1).jumpTo({center:[-58.6,-34.8],zoom:15}));const stable=await view(),count=await page.evaluate(()=>window.__maps.length),loadCount=styles.length;
 await selectMode('both');await waitDensity();await page.getByLabel('Áreas de referencia configuradas',{exact:true}).check();await page.waitForFunction(async()=>{const s=window.__maps.at(-1).getSource('halo-coverage');return s&&(await s.getData()).features.length===1;});
 assert.deepEqual(await page.evaluate(async()=>(await window.__maps.at(-1).getSource('halo-density').getData()).features[0].geometry.coordinates),[-58.6,-34.8]);
 await page.locator('.territory-filters summary').click();await page.getByLabel('Provincia',{exact:true}).fill('Buenos Aires');await page.getByLabel('Municipio/Partido',{exact:true}).fill('La Matanza');await page.getByLabel('Zona',{exact:true}).selectOption(zone.id);await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.territory-metrics dd')?.textContent==='1');await waitDensity();assert.deepEqual(await view(),stable);
 await page.locator('.territory-filters summary').click();const control=page.locator('[data-territory-visualization]');await control.scrollIntoViewIfNeeded();const scroll=await page.evaluate(()=>scrollY);await selectMode('density');assert.ok(Math.abs((await page.evaluate(()=>scrollY))-scroll)<=2);assert.deepEqual(await view(),stable);await selectMode('both');
 for(const theme of ['light','dark']){
  await page.evaluate(mode=>{localStorage.setItem('erp.theme',mode);window.dispatchEvent(new StorageEvent('storage',{key:'erp.theme',newValue:mode}));},theme);await page.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);assert.equal(await page.locator('[data-territory-map]').getAttribute('data-map-style'),'osm-bright');assert.equal(styles.length,loadCount);assert.equal(await page.evaluate(()=>window.__maps.length),count);assert.deepEqual(await view(),stable);assert.equal(await page.getByLabel('Zona',{exact:true}).inputValue(),zone.id);
  for(const width of [320,360,390,430,768,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),theme+' '+width);assert.deepEqual(await view(),stable);if([390,1440].includes(width))await page.screenshot({path:`test-results/territory13/${theme}-${width}.png`,fullPage:true});}
 }
 await page.locator('.territory-filters summary').click();await page.getByRole('button',{name:'Restablecer filtros',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.territory-metrics dd')?.textContent==='2');assert.deepEqual(await view(),stable);
 assert.equal((await f.pool.query('SELECT count(*)::int n FROM cell_memberships')).rows[0].n,0);assert.deepEqual(errors,[]);
 console.log('PASS: jerarquía/zonas/sectores UI, asignación auditada, indicadores y filtros, densidad MapLibre real solo células activas confirmadas, radios, scroll/cámara/instancia, identidad independiente, estilo fijo y 6 anchos Light/Dark. Teselas simuladas.');
}catch(error){console.log('UI DIAGNOSTIC',await page.locator('[data-territory-organization]').innerHTML());await page.screenshot({path:'test-results/territory13/failure.png',fullPage:true});throw error;}finally{await browser.close();await server.close();await f.close();}
