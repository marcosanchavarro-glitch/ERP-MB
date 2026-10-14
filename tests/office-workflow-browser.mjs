import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fixture,testServer,account} from './helpers.mjs';
import {createCellsService} from '../server/cells/service.mjs';
import {assignBatch} from '../server/cells/batch.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {blankCell,today} from '../src/domain/cell.js';
import {blankPerson} from '../src/domain/person.js';
import {revokeUserSessions} from '../server/identity/service.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const f=await fixture(),user=await account(f),server=await testServer(f),cells=createCellsService(f.pool),ctx={user:await principal(f.pool,user.id)};
const a=await cells.save({cell:{...blankCell(),groupCode:'J'}},ctx),b=await cells.save({cell:{...blankCell(),groupCode:'B'}},ctx),people=[];
for(const name of ['Alba','Brisa','Cielo','Dalia'])people.push(await f.people.save({...blankPerson(),names:name+' Demo',lastNames:'Ágil',sex:'HOMBRE'},{actorId:user.id}));
await assignBatch(f.pool,b.id,{personIds:[people[2].id],date:today(),version:1},ctx);await assignBatch(f.pool,a.id,{personIds:[people[3].id],date:today(),version:1},ctx);
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})}),page=await browser.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',err=>errors.push(err.message));
const goto=path=>page.goto(server.base+'/#'+path);
const login=async()=>{await page.getByLabel('Usuario',{exact:true}).fill(user.username);await page.getByLabel('Contraseña',{exact:true}).fill(user.password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();};
try{
 await goto('/oficina/personas');await page.locator('#login-form').waitFor();await login();await page.getByRole('button',{name:'Alta rápida',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Alta rápida de persona'});await dialog.waitFor();
 assert.deepEqual(await dialog.locator('select[name=sex] option').evaluateAll(options=>options.filter(o=>o.value).map(o=>o.textContent)),['Hombre','Mujer']);
 await dialog.getByLabel('Nombres *',{exact:true}).fill('Rápida Demo');await dialog.getByLabel('Apellidos *',{exact:true}).fill('Nueva');await dialog.getByLabel('Sexo',{exact:true}).selectOption('MUJER');
 await revokeUserSessions(f.pool,user.id);await dialog.getByRole('button',{name:'Crear persona',exact:true}).click();await page.locator('#login-form').waitFor();await login();await dialog.waitFor();assert.equal(await dialog.getByLabel('Nombres *',{exact:true}).inputValue(),'Rápida Demo');
 await dialog.getByRole('button',{name:'Crear persona',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.getByRole('link',{name:'Rápida Demo Nueva',exact:true}).waitFor();
 await goto('/oficina/personas/nueva');await page.locator('#person-form').waitFor();assert.deepEqual(await page.locator('#person-form select[name=sex] option').evaluateAll(options=>options.filter(o=>o.value).map(o=>o.textContent)),['Hombre','Mujer']);
 await goto('/oficina/celulas/'+a.id);await page.getByRole('button',{name:'Agregar integrantes',exact:true}).click();const search=page.locator('[data-bulk-search]');await search.fill('Alba');await page.getByRole('checkbox',{name:'Seleccionar Alba Demo Ágil',exact:true}).check();await search.fill('Brisa');await page.getByRole('checkbox',{name:'Seleccionar Brisa Demo Ágil',exact:true}).check();await page.getByText('Seleccionadas: 2',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Quitar Alba Demo Ágil',exact:true}).click();await page.getByText('Seleccionadas: 1',{exact:true}).waitFor();await search.fill('Alba');await page.getByRole('checkbox',{name:'Seleccionar Alba Demo Ágil',exact:true}).check();
 await search.fill('Dalia');await page.getByText('Ya en esta célula',{exact:true}).waitFor();assert.equal(await page.getByRole('checkbox',{name:'Seleccionar Dalia Demo Ágil',exact:true}).isDisabled(),true);
 await search.fill('Cielo');await page.getByText('Actualmente: B1 F',{exact:true}).waitFor();await page.getByRole('button',{name:'Transferir a J1 F',exact:true}).click();assert.equal((await cells.personHistory(people[2].id,{}, {all:true,ids:[]})).current.cellId,b.id);await page.getByRole('button',{name:'Confirmar transferencia',exact:true}).click();await page.getByText('Transferencia realizada. Podés continuar seleccionando personas.',{exact:true}).waitFor();assert.ok(page.url().endsWith(a.id));await page.getByText('Seleccionadas: 2',{exact:true}).waitFor();
 await search.fill('Nueva Contextual');await page.getByRole('button',{name:'+ Crear «Nueva Contextual»',exact:true}).click();await page.locator('.quick-person-form').waitFor();await page.locator('.quick-person-form [name=sex]').selectOption('HOMBRE');await page.getByRole('button',{name:'Crear persona',exact:true}).click();await page.getByText('Seleccionadas: 3',{exact:true}).waitFor();await page.getByText('El sexo de la persona no coincide con el tipo de célula.',{exact:true}).waitFor();
 for(const width of [1440,820,390,320]){await page.setViewportSize({width,height:900});if(width<=760)await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=0);await page.locator('.bulk-footer').scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);await page.screenshot({path:`test-results/bulk-selector-${width}.png`});}
 let batchCalls=0;page.on('request',req=>{if(req.url().endsWith('/members/batch'))batchCalls++;});await page.getByRole('button',{name:'Agregar seleccionadas',exact:true}).click();await page.locator('#cell-operation').waitFor({state:'hidden'});await page.getByText('3 personas agregadas como Miembro.',{exact:true}).waitFor();assert.equal(batchCalls,1);
 assert.equal((await cells.members(a.id,{}, {all:true,ids:[]})).total,5);const created=(await f.people.list({q:'Nueva Contextual'})).items[0];assert.ok(created.id);assert.equal((await cells.personHistory(created.id,{}, {all:true,ids:[]})).current.cellId,a.id);
 assert.deepEqual(errors,[]);console.log('Alta rápida real/contextual, sexo Hombre/Mujer, sesión recuperada, selección entre búsquedas, estados, transferencia confirmada, lote único y responsive: PASS');
}finally{await browser.close();await server.close();await f.close();}
