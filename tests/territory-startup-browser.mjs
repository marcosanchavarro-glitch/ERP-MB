import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fixture,testServer} from './helpers.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright'),f=await fixture(),server=await testServer(f),browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
try{
 await mkdir('test-results/territory15',{recursive:true});
 for(const target of ['/src/app.js','/src/components.js','/src/branding.js']){
  const page=await browser.newPage({viewport:{width:390,height:900}});await page.route('**'+target,route=>route.abort());
  await page.goto(server.base+'/#/territorio/mapa',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Reintentar carga',exact:true}).waitFor();assert.ok(await page.getByRole('alert').isVisible());assert.ok(page.url().endsWith('#/territorio/mapa'));
  await page.screenshot({path:'test-results/territory15/startup-'+target.split('/').at(-1)+'.png',fullPage:true});await page.unroute('**'+target);await page.getByRole('button',{name:'Reintentar carga',exact:true}).click();await page.locator('#login-form').waitFor();assert.ok(page.url().endsWith('#/territorio/mapa'));await page.close();
 }
 const failedConfig=await browser.newPage();await failedConfig.route('**/api/installation',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));await failedConfig.goto(server.base);await failedConfig.getByRole('button',{name:'Reintentar carga',exact:true}).waitFor();await failedConfig.close();
 const noScripts=await browser.newPage();await noScripts.route('**/src/*.js',route=>route.abort());await noScripts.goto(server.base,{waitUntil:'domcontentloaded'});assert.ok(await noScripts.getByRole('heading',{name:'HALO',exact:true}).isVisible());await noScripts.getByText('Si la carga no avanza, recargá esta página para volver a intentar.',{exact:true}).waitFor();await noScripts.close();
 console.log('PASS arranque: fallos del módulo principal/dependencias/configuración ofrecen recuperación, reintento conserva URL y sin JavaScript permanece un estado visible.');
}finally{await browser.close();await server.close();await f.close();}
