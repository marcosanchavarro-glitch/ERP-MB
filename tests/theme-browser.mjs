import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {setup} from './followup-fixture.mjs';
import {account,testServer} from './helpers.mjs';
import {authorizeLeaderAccount} from '../server/identity/leader-accounts.mjs';
import {today} from '../src/domain/cell.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const x=await setup();for(let i=0;i<6;i++)await x.record(i);
const meeting=(await x.meetings.list({cellId:x.c.id,from:x.start,to:x.start},x.ctx)).items[0];
const membership=(await x.f.pool.query('SELECT id FROM cell_memberships WHERE "personId"=$1 AND "endDate" IS NULL',[x.p.id])).rows[0];
await x.cells.move(x.c.id,{kind:'ROLE',personId:x.p.id,membershipId:membership.id,role:'LEADER',date:today(),version:(await x.cells.get(x.c.id)).version},x.ctx);
const leader=await account(x.f,[]);await authorizeLeaderAccount(x.f.pool,{userId:leader.id,personId:x.p.id});
const server=await testServer(x.f),browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})}),context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage();
const errors=[],shots=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
await mkdir('test-results/theme',{recursive:true});
const login=async(user)=>{await page.getByLabel('Usuario',{exact:true}).fill(user.username);await page.getByLabel('Contraseña',{exact:true}).fill(user.password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await page.locator('#login-form').waitFor({state:'detached'});};
const choose=async(value)=>{const picker=page.locator('.theme-picker:visible');if(!await picker.evaluate(e=>e.open))await picker.locator('summary').click();await picker.getByLabel('Tema de la interfaz').selectOption(value);await picker.getByLabel('Tema de la interfaz').press('Escape');assert.equal(await picker.evaluate(e=>e.open),false);};
const shot=async(name,width,theme)=>{await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' '+width+' overflow');const path=`test-results/theme/${theme}-${name}-${width}.png`;await page.screenshot({path,fullPage:true,animations:'disabled',timeout:30000});shots.push(path);};
let visit=0;
const goto=async(path,ready)=>{await page.goto(server.base+'/?visual='+visit+++'#'+path);await page.locator(ready).first().waitFor();};
try{
 await page.goto(server.base);await page.locator('#login-form').waitFor();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
 await page.getByLabel('Usuario',{exact:true}).fill('borrador conservado');const original=page.url();await choose('dark');assert.equal(page.url(),original);assert.equal(await page.getByLabel('Usuario',{exact:true}).inputValue(),'borrador conservado');
 assert.equal(await page.evaluate(()=>localStorage.getItem('erp.theme')),'dark');await page.reload();await page.locator('#login-form').waitFor();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 await choose('system');await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
 await choose('light');await page.emulateMedia({colorScheme:'dark'});assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
 const sibling=await context.newPage();await sibling.goto(server.base);await sibling.evaluate(()=>localStorage.setItem('erp.theme','dark'));await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');await sibling.close();
 for(const theme of ['light','dark']){await choose(theme);for(const width of [1440,390,320])await shot('login',width,theme);}
 await page.setViewportSize({width:1440,height:900});await login(x.user);await page.locator('.area-grid').waitFor();await choose('light');
 await page.locator('.theme-picker summary').focus();await page.keyboard.press('Enter');await page.keyboard.press('Tab');assert.equal(await page.getByLabel('Tema de la interfaz').evaluate(e=>e===document.activeElement),true);await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');if(await page.locator('.theme-picker').evaluate(e=>e.open))await page.keyboard.press('Escape');
 assert.equal(await page.locator('.theme-picker summary').evaluate(e=>e===document.activeElement),true);
 const screens=[['inicio','/','.area-grid'],['oficina','/oficina','main h1'],['personas','/oficina/personas','.people-table'],['ficha','/oficina/personas/'+x.p.id,'.person-data'],['formulario','/oficina/personas/'+x.p.id+'/editar','.person-form-groups'],['celulas','/oficina/celulas','.cells-table'],['celula','/oficina/celulas/'+x.c.id,'.cells-panel'],['asistencia','/oficina/asistencia?view=control','.meeting-summary'],['reunion','/oficina/asistencia/'+meeting.id,'.meeting-editor'],['seguimiento','/oficina/seguimiento','.followup-row'],['usuarios','/administracion/usuarios','.admin-card'],['roles','/administracion/roles','.admin-card'],['calidad','/oficina/calidad','.insight-filters']];
 for(const theme of ['light','dark']){
  await choose(theme);
  for(const [name,path,ready]of screens){await goto(path,ready);assert.equal(await page.locator('html').getAttribute('data-theme'),theme);for(const width of [1440,390,320])await shot(name,width,theme);}
  await goto('/oficina/personas','.people-table');await page.locator('[data-person-id="'+x.p.id+'"]').first().click();await page.getByRole('dialog').waitFor();for(const width of [1440,390,320])await shot('modal',width,theme);
  assert.equal(await page.getByRole('dialog').evaluate(e=>{const token=getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim();const rgb='rgb('+token.slice(1).match(/../g).map(v=>parseInt(v,16)).join(', ')+')';return getComputedStyle(e).backgroundColor===rgb;}),true);await page.getByRole('button',{name:'Cerrar ficha',exact:true}).click();
  await shot('tablet',820,theme);
  const ratios=await page.evaluate(()=>{
   const css=getComputedStyle(document.documentElement),lum=hex=>{const rgb=hex.trim().slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
   return [['text-primary','surface'],['text-secondary','surface'],['primary','surface'],['on-primary','primary'],...['success','warning','danger','info'].map(s=>[s,s+'-soft'])].map(([fg,bg])=>{const a=lum(css.getPropertyValue('--color-'+fg)),b=lum(css.getPropertyValue('--color-'+bg));return {fg,bg,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});
  });for(const r of ratios)assert.ok(r.ratio>=4.5,theme+' '+JSON.stringify(r));
 }
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await login(leader);await page.locator('.leader-card').first().waitFor();
 for(const theme of ['light','dark']){await choose(theme);for(const width of [1440,390,320])await shot('mi-celula',width,theme);}
 const cold=await browser.newContext();await cold.addInitScript(()=>localStorage.setItem('erp.theme','dark'));const coldPage=await cold.newPage();
 let release;const held=new Promise(resolve=>release=resolve);await coldPage.route('**/src/theme-tokens.css',async route=>{await held;await route.continue();});
 await coldPage.goto(server.base,{waitUntil:'commit'});await coldPage.waitForFunction(()=>document.documentElement.dataset.theme==='dark',null,{polling:50});release();await coldPage.locator('#login-form').waitFor();await cold.close();
 const unavailable=await browser.newContext();await unavailable.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new Error('denied');};Storage.prototype.setItem=()=>{throw new Error('denied');};});const p=await unavailable.newPage();await p.goto(server.base);await p.locator('.theme-picker summary').click();await p.getByLabel('Tema de la interfaz').selectOption('dark');assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');await unavailable.close();
 assert.deepEqual(errors,[]);await writeFile('test-results/theme/screenshots.json',JSON.stringify(shots,null,2));
 console.log('Tema PASS: Claro/Oscuro/Sistema, persistencia, cambio SO, sin reload, teclado, pestañas, arranque previo a CSS, storage bloqueado, contraste AA y pantallas 1440/820/390/320.');
}catch(error){await page.screenshot({path:'test-results/theme/failure.png',fullPage:true});console.error('Pantalla:',page.url());throw error;}finally{await browser.close();await server.close();await x.f.close();}
