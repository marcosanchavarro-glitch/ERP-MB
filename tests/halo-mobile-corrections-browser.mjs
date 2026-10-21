import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {attendanceFixture} from './attendance2-fixture.mjs';
import {account,testServer,httpClient} from './helpers.mjs';
import {leaderRole,authorizeLeaderAccount} from '../server/identity/leader-accounts.mjs';
import {today} from '../src/domain/cell.js';
const before=process.env.HALO_CAPTURE_BEFORE==='1',out='test-results/halo-mobile-correction/'+(before?'before':'after');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const x=await attendanceFixture(),roleId=await leaderRole(x.f.pool);
const emptyFew=await account(x.f,[{roleId,scopeType:'global'}]),emptyMany=await account(x.f,[{roleId,scopeType:'global'},{roleId:x.user.roleId,scopeType:'global'}]),activeFew=await account(x.f,[]),limited=await account(x.f,[]);
await x.f.pool.query("INSERT INTO user_permissions(id,user_id,permission,scope_type,scope_id) VALUES(gen_random_uuid(),$1,'modulos.acceder','subarea','hdr-universitarios'),(gen_random_uuid(),$1,'modulos.acceder','subarea','multimedia-fotografia')",[limited.id]);
for(const [person,cell,user]of [[x.late,x.a,activeFew],[x.waiting,x.b,x.user]]){
 const m=(await x.f.pool.query('SELECT id FROM cell_memberships WHERE "personId"=$1 AND "endDate" IS NULL',[person.id])).rows[0];
 await x.cells.move(cell.id,{kind:'ROLE',personId:person.id,membershipId:m.id,role:'LEADER',date:today(),version:(await x.cells.get(cell.id)).version},x.ctx);
 await authorizeLeaderAccount(x.f.pool,{userId:user.id,personId:person.id});
}
const server=await testServer(x.f),browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'}),errors=[];
await mkdir(out,{recursive:true});
try{
 for(const [name,user,active]of [['empty-few',emptyFew,false],['empty-admin',emptyMany,false],['active-few',activeFew,true],['active-admin',x.user,true],['limited',limited,null]]){
  const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:390,height:844});await page.goto(server.base+'/#'+(active===null?'/':'/mi-celula'));
  await page.getByLabel('Usuario',{exact:true}).fill(user.username);await page.getByLabel('Contraseña',{exact:true}).fill(user.password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
  await page.locator(active===null?'.halo-home':active?'.leader-current':'[data-leader-reload]').waitFor();
  const access=await page.evaluate(async()=>(await (await fetch('/api/auth/session')).json()).user.access);
  for(const mode of ['light','dark']){
   const picker=page.locator('.theme-picker:visible');await picker.locator('summary').click();await picker.getByLabel('Tema de la interfaz').selectOption(mode);await picker.getByLabel('Tema de la interfaz').press('Escape');
   for(const width of [320,360,390,430,768]){
    await page.setViewportSize({width,height:900});
    if(!before){
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' overflow '+width);
     assert.equal(await page.locator('.leader-contexts').count(),0);
     const nav=page.getByRole('navigation',{name:'Navegación principal',includeHidden:true});assert.equal(await nav.count(),1);
     const paths=await nav.locator('a').evaluateAll(a=>a.map(e=>e.getAttribute('href').slice(1)));
     assert.equal(paths.length,new Set(paths).size,'duplicate destinations');
     for(const path of paths)assert.ok(path==='/'||path==='/mi-celula'&&access.leaderPortal||access.paths.some(p=>p.path===path||p.path.startsWith(path+'/')),name+' unauthorized '+path);
     if(active===false){assert.ok(await page.locator('.leader-empty').evaluate(e=>e.getBoundingClientRect().height<320));assert.doesNotMatch(await page.locator('main').innerText(),/asignación necesita revisión|error|consultá con oficina/i);if(width===390&&mode==='light'){await page.getByRole('button',{name:'Actualizar',exact:true}).click();await page.locator('.leader-empty').waitFor();}}
     if(width<760){
      const toggle=page.getByRole('button',{name:'Alternar navegación'});assert.equal(await page.locator('.sidebar').evaluate(e=>e.inert),true);await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');assert.equal(await page.locator('.workspace').evaluate(e=>e.inert),true);assert.equal(await page.locator('.sidebar').evaluate(e=>e.inert),false);
      const visibleLinks=page.locator('.sidebar a:visible,.sidebar button:visible');await page.keyboard.press('Shift+Tab');assert.equal(await visibleLinks.last().evaluate(e=>e===document.activeElement),true);
      if(width===390){const office=page.getByRole('button',{name:'Subsecciones de Oficina Manantial',exact:true});if(await office.count()){if(await office.getAttribute('aria-expanded')!=='true')await office.click();assert.ok(await nav.getByRole('link',{name:'Mi trabajo',exact:true}).count()<=1);}await page.screenshot({path:`${out}/${name}-${mode}-menu.png`,fullPage:true,animations:'disabled'});}
      await page.keyboard.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await toggle.evaluate(e=>e===document.activeElement),true);assert.equal(await page.locator('.workspace').evaluate(e=>e.inert),false);
     }
    }
    if(width===390||width===320)await page.screenshot({path:`${out}/${name}-${mode}-${width}.png`,fullPage:true,animations:'disabled'});
   }
  }
  if(!before&&name==='empty-admin'){
   await page.setViewportSize({width:1600,height:1000});await page.goto(server.base+'/#/administracion/usuarios');await page.locator('.admin-list').waitFor();
   await page.goto(server.base+'/#/oficina/asistencia?month=2026-09');await page.locator('.attendance-month-table').waitFor();await page.locator('[data-attendance-distribution] .halo-chart-donut').first().waitFor();assert.equal(await page.locator('[data-attendance-distribution] .halo-chart-donut').count(),2);
   await page.locator('[data-attendance-charts] > summary').click();assert.equal(await page.locator('[data-attendance-analysis] .halo-chart-donut').count(),0);
   for(const width of [320,360,390,430,768]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(width===390)await page.screenshot({path:out+'/attendance-donuts-390.png',fullPage:true,animations:'disabled'});}
  }
  if(!before&&name==='limited'){
   const client=httpClient(server.base);await client.login(user);for(const path of ['/api/people','/api/leader','/api/office-work/monthly'])assert.equal((await client.request(path)).status,403,path);
   await page.goto(server.base+'/#/administracion/usuarios');await page.getByRole('heading',{name:'Acceso no disponible',exact:true}).waitFor();assert.equal(await page.locator('.admin-list').count(),0);
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log(before?'BEFORE captures saved':'HALO mobile correction PASS: 5 perfiles, 5 anchos, 2 modos, menú/foco, vacío y liderazgo activo, administración, donuts sin duplicación y API protegida.');
}finally{await browser.close();await server.close();await x.f.close();}
