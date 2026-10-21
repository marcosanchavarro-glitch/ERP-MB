import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {attendanceFixture} from './attendance2-fixture.mjs';
import {account,testServer,httpClient} from './helpers.mjs';
import {createOfficeWorkService} from '../server/office-work/service.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const x=await attendanceFixture();let instant=new Date('2026-09-15T15:00:00Z');
const work=createOfficeWorkService(x.f.pool,{now:()=>instant,timezone:'America/Argentina/Buenos_Aires'});
for(const [day,p]of [[15,x.p],[17,x.late]]){
 instant=new Date(`2026-09-${day}T15:00:00Z`);const {item}=await work.claim({personId:p.id},x.ctx);
 await work.save({id:randomUUID(),personId:p.id,claimId:item.claimId,type:'CALL',result:'CONTACTO_ESTABLECIDO',origin:'CONTACTO_MENSUAL'},x.ctx);
}
const limited=await account(x.f,[]);
await x.f.pool.query("INSERT INTO user_permissions(id,user_id,permission,scope_type,scope_id) VALUES(gen_random_uuid(),$1,'modulos.acceder','subarea','hdr-universitarios'),(gen_random_uuid(),$1,'modulos.acceder','subarea','multimedia-fotografia')",[limited.id]);
const server=await testServer(x.f),browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'}),page=await browser.newPage(),errors=[],external=[];
page.setDefaultTimeout(18000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(server.base)&&!r.url().startsWith('data:'))external.push(r.url());});
const choose=async mode=>{const p=page.locator('.theme-picker:visible');if(!await p.evaluate(e=>e.open))await p.locator('summary').click();await p.getByLabel('Tema de la interfaz').selectOption(mode);await p.getByLabel('Tema de la interfaz').press('Escape');};
const login=async user=>{await page.getByLabel('Usuario',{exact:true}).fill(user.username);await page.getByLabel('Contraseña',{exact:true}).fill(user.password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await page.locator('#login-form').waitFor({state:'detached'});};
await mkdir('test-results/halo3',{recursive:true});
try{
 await page.goto(server.base+'/#/oficina/trabajo/panorama?month=2026-09');await login(x.user);await page.locator('.halo-chart-donut').first().waitFor();
 const expected=await x.monthly.overview({month:'2026-09'},x.ctx);
 assert.equal(await page.locator('.halo-chart-donut text').first().textContent(),String(expected.totals.covered+expected.totals.pending));
 assert.equal(await page.locator('.halo-chart-line').count(),2);assert.equal(await page.locator('.halo-chart-bars').count(),3);
 assert.ok(await page.locator('.halo-chart-tooltip').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).display==='none')),'tooltips hidden until interaction');
 assert.doesNotMatch(await page.locator('.work-charts').innerText(),/NOTA_PRIVADA_NO_MATRIZ/);
 for(const mode of ['light','dark']){await choose(mode);for(const width of [320,360,390,430,768,1024,1600]){
  await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${mode} charts ${width}`);
  if(width===390||width===1600)await page.screenshot({path:`test-results/halo3/${mode}-charts-${width}.png`,fullPage:true,animations:'disabled'});
 }}
 await page.setViewportSize({width:1600,height:1000});
 const mark=page.locator('.halo-chart-donut .halo-chart-key').first();await mark.focus();await mark.locator('[role=tooltip]').waitFor({state:'visible'});await page.keyboard.press('Escape');await mark.locator('[role=tooltip]').waitFor({state:'hidden'});
 const series=page.locator('.halo-chart-line').first();await series.locator('summary').click();assert.ok(await series.locator('.halo-chart-key').count()>=2);
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.halo-chart-key').first().evaluate(e=>getComputedStyle(e).animationName),'none');
 await page.goto(server.base+'/#/oficina/asistencia/mensual?month=2026-09');await page.locator('.attendance-month-table').waitFor();await page.locator('[data-attendance-charts] > summary').click();await page.locator('.halo-chart-donut').first().waitFor();
 await page.goto(server.base+'/#/oficina/trabajo/panorama?month=2020-01');await page.locator('.work-charts').waitFor();assert.equal(await page.locator('.halo-chart-line svg').count(),0);
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await login(limited);await page.goto(server.base+'/#/');await page.locator('.halo-home').waitFor();assert.equal(await page.locator('.halo-portal').count(),2);assert.equal(await page.locator('.halo-portal[href="#/oficina"]').count(),0);
 const client=httpClient(server.base);await client.login(limited);assert.equal((await client.request('/api/office-work/overview?month=2026-09')).status,403);
 await page.goto(server.base+'/#/oficina/trabajo/panorama');await page.getByRole('heading',{name:'Acceso no disponible',exact:true}).waitFor();assert.equal(await page.locator('.halo-chart').count(),0);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('HALO 3 charts PASS: agregados reales, donut/barras/tendencias, detalles táctiles y teclado, Escape, 7 anchos, 2 modos, vacíos y autorización backend/portales.');
}catch(err){await page.screenshot({path:'test-results/halo3/charts-failure.png',fullPage:true,animations:'disabled'});throw err;}finally{await browser.close();await server.close();await x.f.close();}
