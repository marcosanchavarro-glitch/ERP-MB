import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fixture,account,testServer} from './helpers.mjs';
import {createCellsService} from '../server/cells/service.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {blankCell} from '../src/domain/cell.js';
import {blankPerson} from '../src/domain/person.js';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const f=await fixture(),user=await account(f),ctx={user:await principal(f.pool,user.id)},cells=createCellsService(f.pool),server=await testServer(f);
// Synthetic geography in disposable PostgreSQL only.
const p=await f.people.save({...blankPerson(),names:'Persona',lastNames:'Recomendaciones',sex:'MUJER',birthDate:'2000-01-01',address:'Calle de prueba 123',locality:'Localidad de prueba',province:'Buenos Aires'},{actorId:user.id});
const c=await cells.save({cell:{...blankCell(),groupCode:'R',gender:'F',openedDate:'2020-01-01',latitude:-34.8,longitude:-58.6,coordinateStatus:'VERIFIED',ageUnrestricted:true,coverageRadiusMeters:300}},ctx);
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.setDefaultTimeout(15000);
const errors=[],geoRequests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',r=>{if(r.url().includes('/api/locations/search/'))geoRequests.push(r.url());});
await page.route('**/vendor/maplibre/maplibre-gl.mjs',route=>route.abort());
await page.route('https://tile.openstreetmap.org/**',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')}));
const goto=path=>page.goto(server.base+'/#'+path),panel=()=>page.locator('[data-person-recommendations]');
const open=async()=>{await page.getByRole('button',{name:'Buscar células cercanas',exact:true}).click();await panel().getByRole('heading',{name:c.displayCode,exact:true}).waitFor();};
try{
 await mkdir('test-results/territory12',{recursive:true});await goto('/oficina/personas/'+p.id);
 await page.getByLabel('Usuario',{exact:true}).fill(user.username);await page.getByLabel('Contraseña',{exact:true}).fill(user.password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await open();
 await panel().getByText('Sin distancia calculable',{exact:true}).waitFor();
 for(const theme of ['light','dark'])for(const width of [320,360,390,430,768,1440]){
  await page.setViewportSize({width,height:1000});await page.evaluate(t=>{document.documentElement.dataset.theme=t;},theme);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${theme} ${width}: overflow`);
  assert.equal(await panel().locator('.recommendation-card').count(),1);
  if(width===390)await page.screenshot({path:`test-results/territory12/recommendations-${theme}-390.png`,fullPage:true});
 }
 await page.setViewportSize({width:390,height:1000});
 await panel().locator('summary').click();const form=panel().locator('[data-person-location]');
 assert.equal(await form.locator('[data-location-search]').count(),0);
 await form.getByLabel('País',{exact:true}).fill('Argentina');await form.getByLabel('Latitud',{exact:true}).fill('-34.8');await form.getByLabel('Longitud',{exact:true}).fill('-58.6');
 await form.getByRole('button',{name:'Guardar ubicación confirmada',exact:true}).click();await form.locator('[data-location-save-message]').getByText(/Revisá el punto/).waitFor();
 await form.getByRole('button',{name:'Ubicar manualmente',exact:true}).click();await form.locator('[data-location-preview][data-map-engine="leaflet"]').waitFor();
 await form.getByRole('button',{name:'Confirmar punto para guardar',exact:true}).click();await form.getByRole('button',{name:'Guardar ubicación confirmada',exact:true}).click();
 await panel().getByText('0 m en línea recta',{exact:true}).waitFor();assert.equal(geoRequests.length,0);
 await panel().getByRole('link',{name:'Ver en el mapa',exact:true}).click();await page.locator('[data-territory-detail]').getByRole('heading',{name:c.displayCode,exact:true}).waitFor();
 await page.locator('.territory-marker[aria-pressed="true"]').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 // Contextual Ficha 360° uses the same panel; closing it cleans up the preview.
 await goto('/oficina/personas');await page.getByRole('link',{name:'Persona Recomendaciones',exact:true}).click();await open();await panel().getByText('0 m en línea recta',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Cerrar ficha',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
 assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM cell_memberships')).rows[0].n,0);
 assert.equal((await f.pool.query("SELECT count(*)::int AS n FROM audit_events WHERE action='PERSON_LOCATION_UPDATE'")).rows[0].n,1);
 assert.deepEqual(errors,[]);console.log('PASS: ficha completa/contextual, confirmación manual auditada, sin geocodificación ni membresías, mapa seleccionado, 6 anchos, light/dark.');
}finally{await browser.close();await server.close();await f.close();}
