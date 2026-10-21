import {fixture,testServer,account} from './helpers.mjs';
import {seedDemo} from '../server/demo.mjs';
// Optional browser QA: install Playwright separately or set PLAYWRIGHT_PATH.
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {navigation} from '../src/config.js';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const f=await fixture();await seedDemo(f.people);const user=await account(f),running=await testServer(f),base=running.base;
const browser=await chromium.launch({headless:true, ...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
await mkdir('test-results',{recursive:true});
try {
 for(const [name,width,height] of [['desktop',1440,1000],['tablet',820,1180],['mobile',390,844],['small-mobile',320,740]]) {
  await page.setViewportSize({width,height});
  await page.goto(base);
  await page.waitForFunction(()=>document.querySelector('#login-form')||document.querySelector('.shell'));
  if(await page.locator('#login-form').isVisible()){await page.getByLabel('Usuario',{exact:true}).fill(user.username);await page.getByLabel('Contraseña',{exact:true}).fill(user.password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();}
  await page.locator('.shell').waitFor();
  await page.locator('h1').waitFor();
  const available=(await (await page.request.get(base+'/api/auth/session')).json()).user.access.paths;const portals=await page.locator('.halo-portal').evaluateAll(a=>a.map(e=>e.getAttribute('href').slice(1)));assert.ok(portals.length>0);assert.equal(new Set(portals).size,portals.length);for(const path of portals)assert.ok(available.some(p=>p.path===path));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}: horizontal overflow`);
  await page.screenshot({path:`test-results/${name}.png`,fullPage:true});
  if(width<=760){
   await page.getByRole('button',{name:'Alternar navegación'}).click();
   await page.getByRole('button',{name:'Subsecciones de Oficina Manantial'}).click();
   await page.locator('.nav-children').getByRole('link',{name:'Personas / Matriz',exact:true}).click();
   await page.getByRole('heading',{name:'Personas / Matriz',exact:true}).waitFor();
   assert.equal(await page.locator('.nav-open').count(),0);
   await page.getByRole('button',{name:'Alternar navegación'}).click();
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('.nav-open').count(),0);
   assert.equal(await page.getByRole('button',{name:'Alternar navegación'}).evaluate(el=>el===document.activeElement),true);
  } else {
   await page.getByRole('button',{name:'Subsecciones de Oficina Manantial'}).click();
   assert.equal(await page.getByRole('button',{name:'Subsecciones de Oficina Manantial'}).getAttribute('aria-expanded'),'true');
   await page.getByRole('button',{name:'Subsecciones de HDR',exact:true}).click();
   assert.equal(await page.getByRole('button',{name:'Subsecciones de Oficina Manantial'}).getAttribute('aria-expanded'),'false');
   await page.getByRole('button',{name:'Alternar navegación'}).click();
   assert.equal(await page.locator('.is-collapsed').count(),1);
   await page.getByRole('button',{name:'Alternar navegación'}).click();
  }
  for(const area of navigation.slice(1)) for(const section of [area,...area.children]) {
   if(section.status!=='PLANNED'||!available.some(p=>p.path===section.path)) continue;
   await page.goto(`${base}/#${section.path}`);
   await page.getByRole('heading',{name:section.name,exact:true}).waitFor();
   assert.ok(await page.getByRole('heading',{name:'En preparación'}).isVisible());
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}: ${section.path} overflow`);
  }
  console.log(`${name}: home, navigation and all placeholders passed`);
 }
 await page.goto(base+'/#/unknown');
 await page.getByRole('heading',{name:'Acceso no disponible'}).waitFor();
 await page.goto(base+'/#/');
 await page.getByRole('heading',{name:/^Hola,/}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('Unknown route recovery and browser console passed');
} finally {await browser.close();await running.close();await f.close();}
