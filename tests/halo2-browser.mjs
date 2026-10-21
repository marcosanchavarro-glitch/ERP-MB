import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {setup} from './followup-fixture.mjs';
import {testServer,account} from './helpers.mjs';
import {createOfficeWorkService} from '../server/office-work/service.mjs';
import {authorizeLeaderAccount} from '../server/identity/leader-accounts.mjs';
import {blankPerson} from '../src/domain/person.js';
import {today} from '../src/domain/cell.js';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const x=await setup();for(let i=0;i<6;i++)await x.record(i);
await x.f.pool.query('UPDATE users SET username=$2 WHERE id=$1',[x.user.id,'halo.prueba']);x.user.username='halo.prueba';
await x.f.people.save({...blankPerson(),names:'Lucía',lastNames:'Prueba visual',sex:'MUJER',phone:'1112345678'},{actorId:x.user.id});
await createOfficeWorkService(x.f.pool).saveSettings(x.user.id,{active:true,sexes:['MUJER'],dailyGoal:6,cooldownMinutes:30,claimMinutes:15,version:0},x.ctx);
const membership=(await x.f.pool.query('SELECT id FROM cell_memberships WHERE "personId"=$1 AND "endDate" IS NULL',[x.p.id])).rows[0];
await x.cells.move(x.c.id,{kind:'ROLE',personId:x.p.id,membershipId:membership.id,role:'LEADER',date:today(),version:(await x.cells.get(x.c.id)).version},x.ctx);
const leader=await account(x.f,[]);await authorizeLeaderAccount(x.f.pool,{userId:leader.id,personId:x.p.id});
const server=await testServer(x.f),browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'}),context=await browser.newContext({reducedMotion:'reduce'}),errors=[],shots=[];let page=await context.newPage();
page.setDefaultTimeout(25000);page.on('pageerror',e=>errors.push(e.message));await mkdir('test-results/halo2',{recursive:true});
const theme=async value=>{const p=page.locator('.theme-picker:visible');if(!await p.evaluate(e=>e.open))await p.locator('summary').click();await p.getByLabel('Tema de la interfaz').selectOption(value);await p.getByLabel('Tema de la interfaz').press('Escape');};
const shot=async name=>{const path='test-results/halo2/'+name+'.png';await page.screenshot({path,fullPage:true,animations:'disabled'});shots.push(path);};
const screens=[['inicio','/','.halo-home'],['oficina','/oficina/trabajo','.work-focus'],['personas','/oficina/personas','.people-table'],['asistencia','/oficina/asistencia?month='+x.start.slice(0,7),'.attendance-month-table'],['administracion','/administracion/usuarios','.admin-list'],['celulas','/oficina/celulas','.cells-table'],['seguimiento','/oficina/seguimiento','.followup-row'],['nuevos','/oficina/nuevos','.newcomers'],['citas','/oficina/citas','.cita-list'],['cumpleanos','/oficina/cumpleanos','.insight-filters'],['calidad','/oficina/calidad','.insight-filters'],['importador','/oficina/importar-exportar','.matrix-import'],['formacion','/formacion','.placeholder'],['multimedia','/multimedia','.placeholder'],['hdr','/hdr','.placeholder'],['recepcion','/recepcion','.newcomers']];
try{
 await page.goto(server.base);await page.getByLabel('Usuario',{exact:true}).fill(x.user.username);await page.getByLabel('Contraseña',{exact:true}).fill(x.user.password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await page.locator('#login-form').waitFor({state:'detached'});
 for(const mode of ['light','dark']){await theme(mode);
  for(const [name,path,ready]of screens){await page.goto(server.base+'/#'+path);await page.locator(ready).first().waitFor();await page.evaluate(()=>document.fonts.ready);
   for(const width of [320,360,390,430,768,1024,1600]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),mode+' '+name+' '+width+' overflow');
    if(width===390&&['inicio','oficina','personas','asistencia'].includes(name)||width===1600&&['inicio','oficina','personas','asistencia','mi-celula','administracion','formacion','multimedia','hdr'].includes(name))await shot(mode+'-'+name+'-'+width);
    if(width<431&&await page.locator('.halo-heading').count())assert.ok(await page.locator('.halo-heading').first().evaluate(e=>e.getBoundingClientRect().height<400),name+' hero too tall');
   }
   if(['personas','asistencia'].includes(name))assert.ok((await page.locator('tbody tr').evaluateAll(rows=>rows.map(r=>getComputedStyle(r).backdropFilter))).every(v=>v==='none'));
  }
 }
 const adminPage=page,leaderContext=await browser.newContext({reducedMotion:'reduce'});page=await leaderContext.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(server.base+'/#/mi-celula');await page.getByLabel('Usuario',{exact:true}).fill(leader.username);await page.getByLabel('Contraseña',{exact:true}).fill(leader.password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await page.locator('.leader-current').waitFor();for(const mode of ['light','dark']){await theme(mode);for(const width of [320,360,390,430,768,1024,1600]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'portal overflow '+width);if(width===1600||width===390)await shot(mode+'-mi-celula-'+width);}}await leaderContext.close();page=adminPage;
 await page.goto(server.base+'/#/oficina/personas');await page.locator('.people-table').waitFor();await page.locator('[data-person-id]').first().click();await page.getByRole('dialog').waitFor();for(const width of [320,390,768,1600]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}await shot('dark-ficha-1600');await page.getByRole('button',{name:'Cerrar ficha',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Alternar navegación'}).click();await shot('dark-navegacion-mobile');await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Alternar navegación'}).evaluate(e=>e===document.activeElement),true);
 await theme('system');await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
 await page.setViewportSize({width:640,height:900});await page.evaluate(()=>document.documentElement.style.fontSize='200%');await page.goto(server.base+'/#/oficina/trabajo');await page.locator('.work-focus').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'office text zoom overflow');await page.evaluate(()=>document.documentElement.style.fontSize='');
 assert.deepEqual(errors,[]);await writeFile('test-results/halo2/screenshots.json',JSON.stringify(shots,null,2));console.log('HALO 2 PASS: 17 vistas, 7 anchos, Light/Dark/Sistema, tablas sólidas, progreso real, portal, Ficha, navegación, zoom y consola limpia.');
}catch(e){await shot('failure');console.error('URL:',page.url());throw e;}finally{await browser.close();await server.close();await x.f.close();}
