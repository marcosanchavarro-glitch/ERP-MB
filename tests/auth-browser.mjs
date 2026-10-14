import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fixture,testServer,account} from './helpers.mjs';
import {revokeUserSessions} from '../server/identity/service.mjs';
import {seedDemo} from '../server/demo.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const f=await fixture();await seedDemo(f.people);const user=await account(f),denied=await account(f,[]),s=await testServer(f);
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})}),page=await browser.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
async function login(account){await page.getByLabel('Usuario',{exact:true}).fill(account.username);await page.getByLabel('Contraseña',{exact:true}).fill(account.password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();}
try {
 await page.goto(s.base+'/#/oficina/personas');await page.locator('#login-form').waitFor();
 for(const width of [1440,820,390,320]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`test-results/login-${width}.png`});}
 await login({...user,password:'contraseña-incorrecta'});await page.getByText('Usuario o contraseña incorrectos.',{exact:true}).waitFor();
 await login(user);await page.locator('.people-table').waitFor();
 assert.equal(await page.evaluate(()=>localStorage.length),0);assert.ok(!(await page.evaluate(()=>document.cookie)).includes('sid'));
 await page.getByRole('link',{name:'Nueva persona',exact:true}).click();await page.getByLabel('Nombres',{exact:false}).fill('Borrador Demo');await page.getByLabel('Apellidos',{exact:false}).fill('Recuperado');
 await revokeUserSessions(f.pool,user.id);await page.getByRole('button',{name:'Guardar persona',exact:true}).click();await page.locator('#login-form').waitFor();
 assert.equal(await page.locator('#app').isVisible(),false);
 await login(user);assert.equal(await page.getByLabel('Nombres',{exact:false}).inputValue(),'Borrador Demo');
 await page.getByRole('button',{name:'Guardar persona',exact:true}).click();await page.getByRole('heading',{name:'Borrador Demo Recuperado',exact:true}).waitFor();
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.locator('#login-form').waitFor();
 assert.equal(await page.locator('.profile-body').count(),0);
 await login(denied);await page.getByText('No tenés permiso para realizar esta operación.',{exact:true}).waitFor();
 assert.equal(await page.locator('.people-table').count(),0);assert.deepEqual(errors,[]);
 console.log('Login responsive, contraseña incorrecta, cookies HttpOnly, sesión revocada, conservación de borrador, logout y acceso denegado: PASS');
}finally{await browser.close();await s.close();await f.close();}
