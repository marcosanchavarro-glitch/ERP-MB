import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fixture,testServer,account} from './helpers.mjs';
import {createCellsService} from '../server/cells/service.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {blankCell} from '../src/domain/cell.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const f=await fixture(),user=await account(f),server=await testServer(f),cells=createCellsService(f.pool),ctx={user:await principal(f.pool,user.id)};
const c=await cells.save({cell:{...blankCell(),groupCode:'T',openedDate:'2026-01-01'}},ctx);
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})}),page=await browser.newPage();page.setDefaultTimeout(12000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function goto(edit=false){await page.goto(server.base+'/#/oficina/celulas/'+c.id+(edit?'/editar':''));}
async function save(){await page.getByRole('button',{name:'Guardar célula',exact:true}).click();await page.getByRole('heading',{name:'T1 F',exact:true}).waitFor();}
try{
 await mkdir('test-results/territorio',{recursive:true});await goto();await page.getByLabel('Usuario',{exact:true}).fill(user.username);await page.getByLabel('Contraseña',{exact:true}).fill(user.password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await page.getByRole('heading',{name:'Ubicación y compatibilidad',exact:true}).waitFor();await page.getByText('Sin coordenadas',{exact:true}).waitFor();
 await goto(true);await page.getByLabel('Dirección',{exact:true}).fill('Lugar de reunión de prueba');await page.getByLabel('País',{exact:true}).fill('Argentina');await page.getByLabel('Latitud',{exact:true}).fill('-34.6');await page.getByLabel('Longitud',{exact:true}).fill('-58.4');await page.getByLabel('Edad mínima recomendada',{exact:true}).fill('18');await page.getByLabel('Edad máxima recomendada',{exact:true}).fill('35');await page.getByLabel('Radio de referencia (metros)',{exact:true}).fill('750');await save();await page.getByText(/Pendientes de verificar/).waitFor();
 await goto(true);await page.getByRole('button',{name:'Ubicar manualmente',exact:true}).click();await page.locator('.location-preview.leaflet-container').waitFor();await page.getByRole('button',{name:'Confirmar punto para guardar',exact:true}).click();await save();assert.equal((await cells.get(c.id)).coordinateStatus,'VERIFIED');
 await goto(true);await page.getByLabel('Dirección',{exact:true}).fill('Otro lugar de prueba');await save();await page.getByText(/Pendientes de verificar/).waitFor();
 for(const mode of ['light','dark']){
  await page.evaluate(mode=>{localStorage.setItem('erp.theme',mode);window.dispatchEvent(new StorageEvent('storage',{key:'erp.theme',newValue:mode}));},mode);
  for(const width of [320,360,390,430,768,1440]){
   await page.setViewportSize({width,height:900});
   for(const edit of [false,true]){
    await goto(edit);await (edit?page.getByRole('button',{name:'Guardar célula',exact:true}):page.getByRole('heading',{name:'Ubicación y compatibilidad',exact:true})).waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'),mode);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${mode}/${width}/${edit?'edit':'profile'} overflow`);
    if(edit){assert.equal(await page.getByLabel('Latitud',{exact:true}).inputValue(),'-34.6');await page.getByLabel('Latitud',{exact:true}).focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.name),'longitude');}
    if(width===390||width===320)await page.screenshot({path:`test-results/territorio/${mode}-${width}-${edit?'edit':'profile'}.png`,fullPage:true});
   }
  }
 }
 await goto(true);await page.getByLabel('Latitud',{exact:true}).fill('');await page.getByLabel('Longitud',{exact:true}).fill('');await page.getByLabel('Edad mínima recomendada',{exact:true}).fill('');await page.getByLabel('Edad máxima recomendada',{exact:true}).fill('');await page.getByLabel('Sin restricción etaria',{exact:true}).selectOption('true');await save();await page.getByText('Sin coordenadas',{exact:true}).waitFor();assert.equal((await cells.get(c.id)).ageUnrestricted,true);
 assert.deepEqual(errors,[]);console.log('Territorio: edición, persistencia, verificación, limpieza, teclado, Light/Dark, 320/360/390/430/768/1440: PASS');
}finally{await browser.close();await server.close();await f.close();}
