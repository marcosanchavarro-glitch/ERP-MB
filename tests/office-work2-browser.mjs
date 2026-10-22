import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fixture,account,testServer} from './helpers.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {createOfficeWorkService} from '../server/office-work/service.mjs';
import {blankPerson} from '../src/domain/person.js';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const f=await fixture(),admin=await account(f),ctx={user:await principal(f.pool,admin.id)},s=createOfficeWorkService(f.pool);
const linked=await f.people.save({...blankPerson(),names:'Valentina',lastNames:'Oficina',sex:null},{actorId:admin.id});
await f.pool.query('UPDATE users SET person_id=$2 WHERE id=$1',[admin.id,linked.id]);
await s.saveSettings(admin.id,{active:true,sexes:['MUJER'],dailyGoal:6,cooldownMinutes:30,claimMinutes:15,version:0},ctx);
for(const names of ['Alba','Brisa','Cielo','Dalia'])await f.people.save({...blankPerson(),names,lastNames:'Ficticia',sex:'MUJER',phone:'1112345678'},{actorId:admin.id});
const server=await testServer(f),browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'}),page=await browser.newPage({reducedMotion:'reduce'}),errors=[];
page.on('pageerror',err=>errors.push(err.message));page.setDefaultTimeout(12000);
const goto=path=>page.goto(server.base+'/#'+path);
try{
 await goto('/oficina/trabajo');await page.getByLabel('Usuario',{exact:true}).fill(admin.username);await page.getByLabel('Contraseña',{exact:true}).fill(admin.password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
 await page.getByRole('heading',{name:'Hola, Valentina',exact:true}).waitFor();await page.locator('.work-contact-form').waitFor();
 const first=await page.locator('[data-work-current] [data-person-id]').getAttribute('data-person-id');
 await page.getByRole('button',{name:'No contestó y siguiente',exact:true}).click();await page.getByText('1', {exact:true}).first().waitFor();await page.waitForFunction(id=>document.querySelector('[data-work-current] [data-person-id]')?.dataset.personId!==id,first);await page.locator('.work-contact-form').waitFor();
 assert.equal((await s.personal({},ctx)).metrics.effective,0);assert.equal((await s.personal({},ctx)).metrics.attempts,1);
 await page.locator('[data-work-current] [data-person-id]').click();const dialog=page.getByRole('dialog',{name:'Ficha contextual de persona'});await dialog.getByRole('button',{name:'Contactos de Oficina',exact:true}).click();await dialog.getByRole('heading',{name:'Contactos de Oficina',exact:true}).waitFor();await dialog.getByRole('button',{name:'Cerrar ficha',exact:true}).click();
 await page.locator('[data-work-current] [name=note]').fill('Observación de prueba');await page.getByRole('button',{name:'Guardar y siguiente',exact:true}).click();await page.getByText('1/6',{exact:true}).waitFor();await page.locator('.work-contact-form').waitFor();
 await goto('/oficina/asistencia/mensual');await page.locator('.attendance-month-table').waitFor();await page.locator('.attendance-desktop').getByRole('button',{name:'Abrir ficha',exact:true}).first().click();const contacts=page.getByRole('dialog',{name:'Ficha contextual de persona'});await contacts.getByRole('button',{name:'Registrar contacto',exact:true}).waitFor();await contacts.getByRole('button',{name:'Cerrar ficha',exact:true}).click();assert.ok(page.url().includes('/asistencia/mensual'));
 for(const theme of ['light','dark','system']){await page.emulateMedia({colorScheme:'dark'});await page.getByLabel('Elegir tema').click();await page.getByLabel('Tema de la interfaz').selectOption(theme);await page.getByLabel('Elegir tema').click();for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'monthly overflow '+theme+' '+width);await page.screenshot({path:`test-results/office2-${theme}-${width}.png`,fullPage:true,animations:'disabled'});}}
 await page.setViewportSize({width:1440,height:1000});await goto('/oficina/trabajo/panorama');await page.getByRole('heading',{name:'Equipo de Oficina',exact:true}).waitFor();await goto('/oficina/trabajo/configuracion');await page.getByRole('heading',{name:'Configuración de Oficina',exact:true}).waitFor();await page.getByLabel('Meta diaria',{exact:true}).first().fill('8');await page.getByRole('button',{name:'Guardar perfil',exact:true}).first().click();await page.evaluate(async()=>{window.officeCanLeave=(await import('/src/office-work/controller.js')).canLeaveWork;});await page.waitForFunction(()=>window.officeCanLeave());
 await goto('/oficina/trabajo');await page.getByText('1/8',{exact:true}).waitFor();for(const width of [390,320]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'work overflow '+width);}
 assert.deepEqual(errors,[]);console.log('Oficina 2 browser PASS: perfil, siguiente, No contestó, meta efectiva, Ficha 360, control mensual, contactos, equipo, configuración y temas/320/390/tablet/desktop.');
}catch(err){await page.screenshot({path:'test-results/office2-failure.png',fullPage:true});console.log((await page.locator('main').innerText()).slice(0,1600));console.log(errors);throw err;}finally{await browser.close();await f.close();}
