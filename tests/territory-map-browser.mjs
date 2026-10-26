import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fixture,testServer,account} from './helpers.mjs';
import {createCellsService} from '../server/cells/service.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {blankCell,cellFields} from '../src/domain/cell.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const f=await fixture(),user=await account(f),server=await testServer(f),cells=createCellsService(f.pool),ctx={user:await principal(f.pool,user.id)};
const fixtures=[];for(const [i,location] of [[1,[-34.6037,-58.3816]],[2,[-34.614,-58.39]],[3,null]])fixtures.push(await cells.save({cell:{...blankCell(),groupCode:'T',generation:i,openedDate:'2026-01-01',locality:i===1?'Centro':'Sur',address:'PRIVATE-ADDRESS',notes:'PRIVATE-NOTES',...(location?{latitude:location[0],longitude:location[1],coordinateStatus:i===1?'VERIFIED':'PENDING',recommendedAgeMin:18,recommendedAgeMax:35,coverageRadiusMeters:750}:{})}},ctx));
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',err=>errors.push(err.message));
let tileFailure=false,apiFailure=false;const referers=[];
// No bulk traffic to the community tile service during automated responsive tests.
// Force the compatibility fallback; the real MapLibre engine has its own suite.
await page.route('**/vendor/maplibre/maplibre-gl.mjs',route=>route.abort());
await page.route('https://tile.openstreetmap.org/**',async route=>{referers.push(route.request().headers().referer);if(tileFailure)return route.abort();return route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')});});
await page.route('**/api/territory/cells?**',route=>apiFailure?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Servicio temporalmente no disponible.'})}):route.continue());
const goto=async()=>{await page.goto(server.base+'/#/territorio/mapa');};
const waitData=()=>page.locator('[data-territory-select]').first().waitFor();
const overflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
async function apply(){await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-territory-status]').textContent.includes('Cargando'));}
try{
 await mkdir('test-results/territory-map',{recursive:true});await goto();await page.getByLabel('Usuario',{exact:true}).fill(user.username);await page.getByLabel('Contraseña',{exact:true}).fill(user.password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await waitData();await page.locator('.territory-marker').first().waitFor();
 assert.equal(await page.locator('[data-territory-select]').count(),3);assert.equal(await page.locator('.territory-coverage').count(),0);assert.ok(!(await page.locator('.territory-page').textContent()).includes('PRIVATE'));
 await page.getByRole('button',{name:'Seleccionar T1 F',exact:true}).focus();await page.keyboard.press('Enter');await page.getByRole('heading',{name:'T1 F',exact:true}).waitFor();await page.getByRole('button',{name:'Cerrar detalle',exact:true}).click();
 await page.getByLabel('Mostrar coberturas',{exact:true}).check();await page.locator('.territory-coverage').first().waitFor();assert.equal(await page.locator('.territory-coverage').count(),1);
 const width=await page.locator('.territory-coverage').first().evaluate(p=>p.getBBox().width);await page.getByRole('button',{name:'Acercar mapa',exact:true}).click();await page.waitForFunction(w=>document.querySelector('.territory-coverage')?.getBBox().width>w*1.7,width);assert.ok(await page.locator('.territory-coverage').first().evaluate(p=>p.getBBox().width)>width*1.7);
 await page.locator('[data-territory-select]').first().click();await page.getByRole('heading',{name:'T1 F',exact:true}).waitFor();assert.ok(await page.getByRole('link',{name:'Abrir ficha de célula'}).isVisible());await page.getByRole('button',{name:'Cerrar detalle',exact:true}).click();
 await page.getByLabel('Mostrar coberturas',{exact:true}).uncheck();assert.equal(await page.locator('.territory-coverage').count(),0);
 for(const mode of ['light','dark']){
  await page.evaluate(mode=>{localStorage.setItem('erp.theme',mode);window.dispatchEvent(new StorageEvent('storage',{key:'erp.theme',newValue:mode}));},mode);
  for(const width of [320,360,390,430,768,1440]){
   await page.setViewportSize({width,height:900});assert.equal(await page.getByRole('button',{name:'Volver a la sede',exact:true}).isEnabled(),false);await overflow();const filter=await page.locator('[data-territory-map] .leaflet-tile-pane').evaluate(el=>getComputedStyle(el).filter);assert.equal(filter,'none','La cartografía no recibe filtros CSS');assert.equal(await page.locator('[data-territory-map] .leaflet-marker-pane').evaluate(el=>getComputedStyle(el).filter),'none');if(width<=430)assert.ok(await page.locator('[data-territory-map]').evaluate(el=>el.getBoundingClientRect().top+scrollY<360),'Mapa visible antes que los avisos en móvil');
   await page.locator('[data-territory-select]').first().focus();await page.keyboard.press('Enter');await page.getByRole('heading',{name:'T1 F',exact:true}).waitFor();assert.equal(await page.locator('[data-territory-detail]').evaluate(el=>el===document.activeElement),true);await overflow();
   if(width===390||width===1440)await page.screenshot({path:`test-results/territory-map/${mode}-${width}.png`,fullPage:true});await page.getByRole('button',{name:'Cerrar detalle',exact:true}).click();
   if(width<=760){await page.locator('[data-action="toggle-nav"]').click();await page.locator('.sidebar').getByRole('link',{name:'Mapa de células',exact:false}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('[data-action="toggle-nav"]').getAttribute('aria-expanded'),'false');}
  }
 }
 assert.equal(await page.locator('.territory-pin').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
 await page.emulateMedia({reducedMotion:'no-preference',colorScheme:'dark'});await page.evaluate(()=>{localStorage.setItem('erp.theme','system');window.dispatchEvent(new StorageEvent('storage',{key:'erp.theme',newValue:'system'}));});assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');assert.equal(await page.locator('.territory-pin').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0.18s');
 await page.locator('.territory-filters summary').click();await page.locator('[name=q]').fill('T1');await page.locator('[name=locality]').fill('Centro');await page.locator('[name=gender]').selectOption('F');await page.locator('[name=ageMin]').fill('20');await page.locator('[name=ageMax]').fill('25');await page.locator('[name=location]').selectOption('verified');await apply();assert.equal(await page.locator('[data-territory-select]').count(),1);
 await page.locator('[name=q]').fill('NO-EXISTE');await apply();await page.getByText('Sin células para estos filtros. Podés restablecerlos e intentar nuevamente.',{exact:true}).waitFor();assert.equal(await page.locator('.leaflet-container').count(),1);
 await page.getByRole('button',{name:'Restablecer filtros',exact:true}).click();await waitData();await page.locator('[name=location]').selectOption('missing');await apply();assert.equal(await page.locator('.territory-marker').count(),0);assert.equal(await page.locator('[data-territory-select]').count(),1);
 await page.getByRole('button',{name:'Restablecer filtros',exact:true}).click();await waitData();tileFailure=true;await apply();await page.getByRole('button',{name:'Acercar mapa',exact:true}).click();await page.getByRole('button',{name:'Acercar mapa',exact:true}).click();await page.getByRole('button',{name:'Reintentar mapa',exact:true}).waitFor();assert.equal(await page.locator('[data-territory-select]').count(),3);tileFailure=false;await page.getByRole('button',{name:'Reintentar mapa',exact:true}).click();await page.locator('[data-territory-map-state]').waitFor({state:'hidden'});
 apiFailure=true;await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.getByRole('button',{name:'Reintentar',exact:true}).waitFor();assert.equal(await page.locator('[data-territory-select]').count(),0);assert.equal(await page.locator('.territory-marker').count(),0);apiFailure=false;await page.getByRole('button',{name:'Reintentar',exact:true}).click();await waitData();
 assert.ok(referers.length>0&&referers.every(r=>r===server.base+'/'),'OSM receives origin-only Referer');
 await page.goto(server.base+'/#/');await page.locator('.halo-home').waitFor();assert.equal(await page.locator('.leaflet-container').count(),0);assert.deepEqual(errors,[]);
 console.log('Mapa PASS: coordenadas reales de fixtures, radios escalables, filtros, selección/teclado, estados/red/proveedor, privacidad, limpieza, Light/Dark, reduced motion y 320/360/390/430/768/1440. Teselas simuladas.');
}finally{await browser.close();await server.close();await f.close();}
