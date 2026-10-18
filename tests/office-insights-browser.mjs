import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fixture,account,testServer} from './helpers.mjs';
import {blankPerson} from '../src/domain/person.js';
import {calendarToday} from '../src/domain/calendar.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const f=await fixture(),admin=await account(f),server=await testServer(f),today=calendarToday();
await f.people.save({...blankPerson(),names:'Cumple',lastNames:'Ejemplo',birthDate:'1990'+today.slice(4),sex:'MUJER'},{actorId:admin.id});
await f.people.save({...blankPerson(),names:'Corregir',lastNames:'Ficha'},{actorId:admin.id});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})}),page=await browser.newPage();page.setDefaultTimeout(15000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.emulateMedia({reducedMotion:'reduce'});
const apply=()=>page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();
const ready=()=>page.locator('[data-insight-results][aria-busy]').waitFor({state:'detached'});
try{
 await page.goto(server.base+'/#/oficina/cumpleanos');await page.getByLabel('Usuario',{exact:true}).fill(admin.username);await page.getByLabel('Contraseña',{exact:true}).fill(admin.password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
 await page.getByRole('heading',{name:'Cumpleaños',exact:true}).waitFor();await page.getByRole('link',{name:'Cumple Ejemplo',exact:true}).waitFor();
 assert.match(await page.locator('[data-insight-results]').innerText(),/Edad actual/);
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'birthday overflow '+width);await page.screenshot({path:`test-results/phase16-birthdays-${width}.png`,fullPage:true});}
 await page.getByLabel('Período',{exact:true}).selectOption('all');await page.getByLabel('Buscar persona',{exact:true}).fill('Cumple');await apply();await ready();
 await page.getByRole('link',{name:'Cumple Ejemplo',exact:true}).click();await page.getByRole('dialog',{name:'Ficha contextual de persona'}).waitFor();await page.getByRole('button',{name:'Cerrar ficha',exact:true}).click();assert.equal(await page.getByLabel('Buscar persona',{exact:true}).inputValue(),'Cumple');
 await page.getByRole('button',{name:'Limpiar',exact:true}).click();await ready();await page.getByRole('link',{name:'Cumple Ejemplo',exact:true}).waitFor();
 await page.goto(server.base+'/#/oficina/calidad');await page.getByRole('heading',{name:'Calidad de datos',exact:true}).waitFor();await page.getByRole('button',{name:'Sin fecha de nacimiento: 1',exact:true}).waitFor();
 await page.getByRole('button',{name:'Sin fecha de nacimiento: 1',exact:true}).click();await ready();assert.equal(await page.locator('.insight-item').count(),1);
 await page.getByRole('link',{name:'Corregir Ficha',exact:true}).click();await page.getByRole('dialog').getByRole('link',{name:'Editar persona',exact:true}).click();await page.getByRole('heading',{name:'Editar persona',exact:true}).waitFor();
 await page.getByLabel('Fecha de nacimiento',{exact:true}).fill('2000-01-01');await page.getByRole('button',{name:'Guardar persona',exact:true}).click();await page.getByRole('link',{name:'← Volver a la consulta',exact:true}).click();await page.getByText('No hay registros para estos filtros.',{exact:true}).waitFor();assert.equal(await page.getByLabel('Problema',{exact:true}).inputValue(),'missing_birthDate');
 await page.getByRole('button',{name:'Limpiar',exact:true}).click();await ready();
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'quality overflow '+width);await page.screenshot({path:`test-results/phase16-quality-${width}.png`,fullPage:true});}
 await page.getByRole('button',{name:'Células',exact:true}).click();await page.getByText('No hay registros para estos filtros.',{exact:true}).waitFor();assert.ok(!(await page.locator('[data-insight-results]').innerText()).includes('Corregir'));
 assert.deepEqual(errors,[]);console.log('1.6 browser PASS: cumpleaños, filtros, contexto, corrección y retorno, indicadores, pestañas, 1440/768/390/320');
}finally{await browser.close();await server.close();await f.close();}
