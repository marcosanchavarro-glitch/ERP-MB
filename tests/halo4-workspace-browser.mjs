import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {attendanceFixture} from './attendance2-fixture.mjs';
import {account,testServer} from './helpers.mjs';
import {leaderRole} from '../server/identity/leader-accounts.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const x=await attendanceFixture(),roleId=await leaderRole(x.f.pool),mixed=await account(x.f,[{roleId:x.user.roleId,scopeType:'global'},{roleId,scopeType:'global'}]),few=await account(x.f,[]),planned=await account(x.f,[]);
await x.f.pool.query("INSERT INTO user_permissions(id,user_id,permission,scope_type) VALUES(gen_random_uuid(),$1,'personas.ver','global'),(gen_random_uuid(),$1,'celulas.ver','global')",[few.id]);
await x.f.pool.query("INSERT INTO user_permissions(id,user_id,permission,scope_type,scope_id) VALUES(gen_random_uuid(),$1,'modulos.acceder','subarea','multimedia-fotografia')",[planned.id]);
const server=await testServer(x.f),browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'}),page=await browser.newPage({reducedMotion:'reduce'}),errors=[],requests=[];
page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/'))requests.push(new URL(r.url()).pathname);});
await mkdir('test-results/halo4',{recursive:true});
const login=async user=>{await page.getByLabel('Usuario',{exact:true}).fill(user.username);await page.getByLabel('Contraseña',{exact:true}).fill(user.password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await page.locator('.halo-home').waitFor();await page.locator('[data-home-work] [data-dashboard-content][aria-busy=true]').waitFor({state:'detached'});};
const theme=async value=>{const p=page.locator('.theme-picker:visible');if(!await p.evaluate(e=>e.open))await p.locator('summary').click();await p.getByLabel('Tema de la interfaz').selectOption(value);await p.getByLabel('Tema de la interfaz').press('Escape');};
try{
 await page.goto(server.base+'/#/');await login(mixed);
 const initialHash=new URL(page.url()).hash;await page.locator('.skip-link').focus();await page.locator('.skip-link').press('Enter');assert.equal(new URL(page.url()).hash,initialHash);assert.equal(await page.locator('main').evaluate(e=>e===document.activeElement),true);
 for(const mode of ['light','dark']){await theme(mode);for(const width of [320,360,390,430,768,1024,1600]){
  await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),mode+' '+width);
  assert.doesNotMatch(await page.locator('main').innerText(),/undefined|null|NaN|\[object Object\]|Tu próximo paso|Espacios para servir|permisos efectivos|NOTA_PRIVADA_NO_MATRIZ/);
  assert.ok(await page.locator('.welcome').evaluate(e=>e.getBoundingClientRect().height<250));
  const paths=await page.locator('.halo-portal').evaluateAll(a=>a.map(e=>e.getAttribute('href')));assert.equal(paths.length,new Set(paths).size);
  const actions=await page.locator('.home-operations .dashboard-actions a').evaluateAll(a=>a.map(e=>e.getAttribute('href')));assert.ok(actions.every(p=>!paths.includes(p)));
  if(width===390||width===1600)await page.screenshot({path:`test-results/halo4/${mode}-workspace-${width}.png`,fullPage:true,animations:'disabled'});
 }}
 assert.equal(requests.filter(p=>p==='/api/office/dashboard').length,1);assert.equal(requests.filter(p=>p==='/api/office-work/personal').length,0);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Alternar navegación'}).click();await page.keyboard.press('Escape');assert.equal(requests.filter(p=>p==='/api/office/dashboard').length,1);
 await page.locator('.home-more summary').first().click();await page.locator('.home-more summary').first().press('Enter');assert.equal(await page.locator('.home-more').first().evaluate(e=>e.open),false);
 await page.locator('.halo-portal').first().focus();assert.equal(await page.locator('.halo-portal-graphic').first().evaluate(e=>getComputedStyle(e).transform),'none');
 // Errors stay visible and retryable; no fake successful summary or stale counters.
 await page.route('**/api/office/dashboard',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'No pudimos cargar el resumen.'})}));
 await page.reload();await page.locator('[data-dashboard-error]').getByText('No pudimos cargar el resumen.',{exact:true}).waitFor();assert.equal(await page.locator('[data-widget]').count(),0);
 await page.unroute('**/api/office/dashboard');await page.getByRole('button',{name:'Actualizar',exact:true}).click();await page.locator('[data-dashboard-content][aria-busy=true]').waitFor({state:'detached'});
 await page.route('**/api/office/dashboard',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({generatedAt:new Date().toISOString(),timezone:'UTC',actions:[],activity:[],widgets:[{id:'invalid',title:'Resumen',items:[{path:'/oficina',label:'Pendiente',count:null}]}]})}));
 await page.reload();await page.getByText('La respuesta del resumen está incompleta. Reintentá con Actualizar.',{exact:true}).waitFor();assert.doesNotMatch(await page.locator('main').innerText(),/undefined|null|NaN/);await page.unroute('**/api/office/dashboard');
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await login(few);
 const fewPaths=await page.locator('.halo-portal').evaluateAll(a=>a.map(e=>e.getAttribute('href')));assert.deepEqual(fewPaths.sort(),['#/oficina/celulas','#/oficina/dashboard','#/oficina/personas'].sort());assert.equal(await page.locator('.dashboard-actions a').count(),0);
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();const count=requests.filter(p=>p==='/api/office/dashboard').length;await login(planned);assert.equal(await page.locator('.halo-portal').count(),0);assert.equal(await page.locator('[data-home-work]').count(),0);assert.equal(requests.filter(p=>p==='/api/office/dashboard').length,count);
 await page.goto(server.base+'/#/oficina/personas');await page.getByRole('heading',{name:'Acceso no disponible',exact:true}).waitFor();assert.equal(await page.locator('.people-table').count(),0);
 assert.deepEqual(errors,[]);console.log('HALO 4 workspace PASS: navegación disponible y única, saludo compacto, 7 anchos/2 modos, pocos accesos, resumen autorizado en una consulta, sin datasets completos, carga/error/reintento/DTO incompleto y reduced motion.');
}catch(err){await page.screenshot({path:'test-results/halo4/workspace-failure.png',fullPage:true,animations:'disabled'});throw err;}finally{await browser.close();await server.close();await x.f.close();}
