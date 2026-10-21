// UI contract tests: controlled API responses, no database or real account.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {createRequire} from 'node:module';
import {blankPerson} from '../src/domain/person.js';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright'),workspace=resolve('.');
const server=createServer(async(req,res)=>{try{const file=resolve(workspace,'.'+(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':decodeURIComponent(new URL(req.url,'http://localhost').pathname)));if(!file.startsWith(workspace+sep))throw Error();const data=await readFile(file);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'}),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
let current='a',mode='success',gate=Promise.resolve(),release=()=>{},profileGate=Promise.resolve(),releaseProfile=()=>{};
const hold=()=>{gate=new Promise(r=>release=r);};
const user=()=>({id:current,username:'cuenta-'+current,access:{paths:[{path:'/oficina',label:'Oficina'},{path:'/oficina/personas',label:'Personas'},{path:'/oficina/celulas',label:'Células'},{path:'/oficina/dashboard',label:'Dashboard'}],officeWork:{}}});
const person=owner=>({...blankPerson(),id:'12345678-1234-4234-8234-123456789012',names:owner==='a'?'NombrePrivadoAnterior':'PersonaActual',lastNames:'Prueba',completeness:{percent:0,complete:false,missing:[]},capabilities:{history:false,edit:false,account:false}});
await page.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname;let body={},status=200;
 if(path==='/api/installation')body={};
 else if(path==='/api/auth/session')body={authenticated:true,user:user(),csrfToken:'test'};
 else if(path==='/api/auth/logout')body={};
 else if(path==='/api/auth/login'){current='b';body={user:user(),csrfToken:'test'};}
 else if(path==='/api/people/meta')body={capabilities:{create:false},localities:[]};
 else if(path==='/api/people'){const owner=current,savedMode=mode;await gate;status=savedMode==='error'?503:savedMode==='denied'?403:200;body=status!==200?{message:savedMode==='denied'?'Acceso denegado de prueba':'Error de prueba'}:{total:savedMode==='empty'?0:1,page:1,pages:1,items:savedMode==='empty'?[]:[person(owner)]};}
 else if(path.startsWith('/api/people/')){await profileGate;body=person(current);}
 else if(path==='/api/cells/meta')body={capabilities:{crear:false}};
 else if(path==='/api/cells'){await gate;body={items:[],total:0,page:1,pages:1};}
 else if(path==='/api/office/dashboard'){await gate;body={timezone:'UTC',generatedAt:new Date().toISOString(),actions:[],widgets:[],activity:[]};}
 else {status=403;body={message:'Acceso denegado de prueba'};}
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
});
try{
 hold();await page.goto(base+'/#/oficina/personas');await page.locator('[data-skeleton="table"]').waitFor();assert.equal(await page.locator('.skeleton-table th').count(),5);assert.ok(!(await page.locator('main').innerText()).includes('NombrePrivadoAnterior'));release();await page.getByRole('link',{name:'NombrePrivadoAnterior Prueba',exact:true}).waitFor();assert.equal(await page.locator('[data-skeleton]').count(),0);
 profileGate=new Promise(r=>releaseProfile=r);await page.getByRole('link',{name:'NombrePrivadoAnterior Prueba',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Ficha contextual de persona'});await dialog.locator('[data-skeleton="profile"]').waitFor();releaseProfile();await dialog.getByRole('heading',{name:'NombrePrivadoAnterior Prueba',exact:true}).waitFor();await dialog.getByRole('button',{name:'Cerrar ficha',exact:true}).click();
 for(const state of ['empty','error','denied']){mode=state;hold();await page.getByRole('button',{name:'Cambiar dirección del orden'}).click();await page.locator('[data-skeleton="table"]').waitFor();release();await page.getByText(state==='empty'?'No hay personas para mostrar':state==='error'?'Error de prueba':'Acceso denegado de prueba',{exact:true}).waitFor();assert.equal(await page.locator('[data-skeleton]').count(),0);}
 mode='success';hold();await page.getByRole('button',{name:'Cambiar dirección del orden'}).click();await page.locator('[data-skeleton="table"]').waitFor();const releaseOld=release;await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.locator('#login-form').waitFor();assert.ok(!(await page.locator('body').innerText()).includes('NombrePrivadoAnterior'));hold();await page.getByLabel('Usuario',{exact:true}).fill('cuenta-b');await page.getByLabel('Contraseña',{exact:true}).fill('solo-prueba');await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await page.locator('[data-skeleton="table"]').waitFor();releaseOld();assert.equal(await page.locator('[name=q]').inputValue(),'');assert.ok(!(await page.locator('main').innerText()).includes('NombrePrivadoAnterior'));release();await page.getByRole('link',{name:'PersonaActual Prueba',exact:true}).waitFor();
 await page.evaluate(()=>{window.skeletonMain=document.querySelector('#main');window.skeletonShell=document.querySelector('.shell');window.skeletonHeader=document.querySelector('.topbar');window.skeletonSidebar=document.querySelector('.sidebar');});hold();await page.goto(base+'/#/oficina/celulas');await page.locator('[data-skeleton="table"]').waitFor();assert.ok(await page.evaluate(()=>!window.skeletonMain.isConnected&&window.skeletonShell===document.querySelector('.shell')&&window.skeletonHeader===document.querySelector('.topbar')&&window.skeletonSidebar===document.querySelector('.sidebar')));
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.skeleton-shape').first().evaluate(el=>getComputedStyle(el).animationName),'none');
 for(const theme of ['light','dark','system']){await page.getByLabel('Elegir tema').click();await page.getByLabel('Tema de la interfaz').selectOption(theme);await page.getByLabel('Elegir tema').click();for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),theme+' '+width);if(width===320&&theme!=='system')await page.screenshot({path:`test-results/skeleton-${theme}-320.png`,fullPage:true,animations:'disabled'});}}
 release();await page.getByText('No hay células para estos filtros.',{exact:true}).waitFor();hold();await page.goto(base+'/#/oficina/dashboard');await page.locator('[data-skeleton="dashboard"]').waitFor();release();await page.getByRole('heading',{name:'Actividad reciente',exact:true}).waitFor();assert.equal(await page.locator('[data-skeleton]').count(),0);assert.deepEqual(errors,[]);console.log('Skeleton browser PASS: success, empty, error, 403, ficha inmediata, cuenta nueva sin datos previos, shell estable, reduced motion, temas y 320/390/768/1440.');
}finally{release();releaseProfile();await browser.close();await new Promise(r=>server.close(r));}
