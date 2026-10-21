import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fixture,account,testServer} from './helpers.mjs';
import {blankPerson} from '../src/domain/person.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const f=await fixture(),user=await account(f),limited=await account(f,[]);
await f.pool.query('UPDATE users SET username=$2 WHERE id=$1',[user.id,'marcos.prueba']);user.username='marcos.prueba';
await f.pool.query('UPDATE users SET username=$2 WHERE id=$1',[limited.id,'valen.prueba']);limited.username='valen.prueba';
await f.pool.query("INSERT INTO user_permissions(id,user_id,permission,scope_type,scope_id) VALUES(gen_random_uuid(),$1,'modulos.acceder','subarea','hdr-universitarios'),(gen_random_uuid(),$1,'modulos.acceder','subarea','multimedia-fotografia')",[limited.id]);
for(const [names,lastNames]of [['Ana','Paz'],['Lucas','Ríos'],['Sofía','Díaz']])await f.people.save({...blankPerson(),names,lastNames},{actorId:user.id});
const server=await testServer(f),browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage(),errors=[],failures=[],external=[];
page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/'))failures.push(r.url());});
page.on('request',r=>{if(!r.url().startsWith(server.base)&&!r.url().startsWith('data:'))external.push(r.url());});
await mkdir('test-results/halo1',{recursive:true});
const login=async u=>{await page.getByLabel('Usuario',{exact:true}).fill(u.username);await page.getByLabel('Contraseña',{exact:true}).fill(u.password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await page.locator('#login-form').waitFor({state:'detached'});};
const choose=async value=>{const picker=page.locator('.theme-picker:visible');if(!await picker.evaluate(e=>e.open))await picker.locator('summary').click();await picker.getByLabel('Tema de la interfaz').selectOption(value);await picker.getByLabel('Tema de la interfaz').press('Escape');};
const noOverflow=async label=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' overflow');
const shot=async name=>page.screenshot({path:'test-results/halo1/'+name+'.png',fullPage:true,animations:'disabled'});
const contrast=async()=>page.evaluate(()=>{
 const s=getComputedStyle(document.documentElement),l=hex=>{const c=hex.trim().slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
 return [['text-primary','surface'],['text-secondary','surface'],['primary','surface'],['on-primary','primary'],...['success','warning','danger','info'].map(k=>[k,k+'-soft'])].map(([a,b])=>{const x=l(s.getPropertyValue('--color-'+a)),y=l(s.getPropertyValue('--color-'+b));return{a,b,ratio:(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};});
});
try{
 await page.setViewportSize({width:1440,height:1000});await page.goto(server.base);await page.locator('#login-form').waitFor();await page.evaluate(()=>document.fonts.ready);
 assert.ok(await page.evaluate(()=>document.fonts.check('500 16px Archivo')));
 await page.getByLabel('Usuario',{exact:true}).fill('Borrador');await choose('dark');assert.equal(await page.getByLabel('Usuario',{exact:true}).inputValue(),'Borrador');await shot('login-desktop-dark');await choose('light');await shot('login-desktop-light');
 for(const width of [320,360,390,430,768]){await page.setViewportSize({width,height:900});await noOverflow('login '+width);}
 await page.setViewportSize({width:1440,height:1000});await login(user);await page.locator('.halo-home').waitFor();await page.evaluate(()=>document.fonts.ready);await page.getByRole('heading',{name:'Hola, marcos.prueba.',exact:true}).waitFor();
 for(const theme of ['light','dark','system']){await choose(theme);if(theme==='system'){await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');assert.equal(await page.locator('html').getAttribute('data-theme'),'light');}
  for(const width of [320,360,390,430,768,1440]){await page.setViewportSize({width,height:1000});await noOverflow(theme+' home '+width);const sizes=await page.locator('.halo-portal').evaluateAll(a=>a.map(e=>e.getBoundingClientRect().height));assert.ok(sizes.every(h=>h>=44));if(width===1440&&theme!=='system')await shot('inicio-desktop-'+theme);if(width===390&&theme==='light')await shot('inicio-mobile');}
  for(const pair of await contrast())assert.ok(pair.ratio>=4.5,theme+' '+JSON.stringify(pair));
 }
 await choose('light');await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Alternar navegación'}).click();assert.equal(await page.locator('.workspace').evaluate(e=>e.inert),true);await noOverflow('mobile nav');await shot('navegacion-mobile');await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Alternar navegación'}).evaluate(e=>e===document.activeElement),true);
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('link',{name:/^Personas \/ Matriz/}).click();await page.locator('.people-table').waitFor();await noOverflow('personas');await shot('operativa-personas-light');
 const table=await page.locator('.people-table').evaluate(e=>({background:getComputedStyle(e).backgroundImage,font:getComputedStyle(e).fontFamily}));assert.equal(table.background,'none');assert.ok(table.font.includes('Archivo'));
 await choose('dark');await shot('operativa-personas-dark');await page.locator('[data-person-id]').first().click();await page.getByRole('dialog').waitFor();await noOverflow('ficha');await page.getByRole('button',{name:'Cerrar ficha',exact:true}).click();
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await login(limited);await page.goto(server.base+'/#/');await page.locator('.halo-home').waitFor();assert.equal(await page.locator('.halo-portal').count(),0);assert.equal(await page.locator('.home-empty').count(),1);assert.equal(await page.locator('.halo-portal[href="#/oficina/personas"]').count(),0);assert.doesNotMatch(await page.locator('main').innerText(),/scope|permission|permisos efectivos|origen del acceso/i);
 await page.setViewportSize({width:390,height:844});await choose('light');await shot('inicio-mobile-acotado');
 await page.setViewportSize({width:640,height:900});await page.evaluate(()=>document.documentElement.style.fontSize='200%');await noOverflow('200% text zoom');await page.evaluate(()=>document.documentElement.style.fontSize='');
 assert.equal(await page.locator('.halo-orbit').evaluate(e=>getComputedStyle(e).animationName),'none');assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);assert.deepEqual(external,[]);
 await writeFile('test-results/halo1/result.json',JSON.stringify({status:'PASS',widths:[320,360,390,430,768,1440],themes:['light','dark','system'],externalRequests:external,errors,contrast:await contrast()},null,2));
 console.log('HALO 1 PASS: login, Inicio, shell, permisos filtrados, tres temas, seis anchos, zoom, foco/teclado, formularios/tablas/Ficha, fuentes locales y sin requests externos.');
}catch(e){await shot('failure');console.error('URL:',page.url());throw e;}finally{await browser.close();await server.close();await f.close();}
