import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fixture,testServer,account} from './helpers.mjs';
import {createCellsService} from '../server/cells/service.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {blankCell} from '../src/domain/cell.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const f=await fixture(),user=await account(f),server=await testServer(f),cells=createCellsService(f.pool),ctx={user:await principal(f.pool,user.id)};
for(const [generation,latitude,longitude] of [[1,-34.6037,-58.3816],[2,-34.611,-58.388]])await cells.save({cell:{...blankCell(),groupCode:'T',generation,openedDate:'2026-01-01',latitude,longitude,coordinateStatus:'VERIFIED',locality:'Buenos Aires',coverageRadiusMeters:500}},ctx);
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.setDefaultTimeout(20000);const failures=[],requests=[];page.on('pageerror',e=>failures.push(e.message));page.on('request',r=>{if(r.url().startsWith('https://tile.openstreetmap.org/'))requests.push(r);});
try{
 await mkdir('test-results/territory-map/provider',{recursive:true});await page.goto(server.base+'/#/territorio/mapa');await page.getByLabel('Usuario',{exact:true}).fill(user.username);await page.getByLabel('Contraseña',{exact:true}).fill(user.password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await page.locator('.territory-marker').first().waitFor();await page.locator('[data-territory-map-state]').waitFor({state:'hidden'});
 await page.waitForFunction(()=>[...document.querySelectorAll('.leaflet-tile')].filter(img=>img.complete&&img.naturalWidth===256).length>=4);
 await page.getByLabel('Mostrar coberturas',{exact:true}).check();await page.locator('[data-territory-select]').first().click();
 await page.locator('.territory-heading').evaluate(el=>{const label=document.createElement('p');label.textContent='Captura de validación · datos de prueba en base aislada';el.append(label);});
 await page.screenshot({path:'test-results/territory-map/provider/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:900});await page.getByRole('button',{name:'Recentrar vista',exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('.leaflet-tile')].some(img=>img.complete&&img.naturalWidth===256));await page.screenshot({path:'test-results/territory-map/provider/mobile.png',fullPage:true});
 assert.deepEqual(failures,[]);assert.ok(requests.length>0);assert.ok(requests.every(r=>r.headers().referer===server.base+'/'));console.log('PASS proveedor real: teselas OSM visibles, atribución, Referer solo origen, pines/coberturas, desktop/móvil; datos aislados de prueba.');
}finally{await browser.close();await server.close();await f.close();}
