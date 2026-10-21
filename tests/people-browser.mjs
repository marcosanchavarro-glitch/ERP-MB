// Runs against a real, isolated PostgreSQL database and an authenticated account.
import {createRequire} from 'node:module';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {fixture,testServer,account} from './helpers.mjs';

import {seedDemo} from '../server/demo.mjs';
import {blankPerson} from '../src/domain/person.js';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const f=await fixture(),store=f.people;
const user=await account(f);
await seedDemo(store);
for(const suffix of ['Uno','Dos','Tres','Cuatro','Cinco','Seis','Siete','Ocho','Nueve','Diez','Once','Doce','Trece','Catorce','Quince','Dieciséis','Diecisiete','Dieciocho','Diecinueve','Veinte','Veintiuno','Veintidós'])await store.save({...blankPerson(),names:`Persona Demo ${suffix}`,lastNames:'Prueba'},{actorId:'system:test-demo'});
const running=await testServer(f);const base=running.base;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
await mkdir('test-results',{recursive:true});
const heading=text=>page.getByRole('heading',{name:text,exact:true});
const noOverflow=async label=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth && [...document.querySelectorAll('dialog[open]')].every(el=>el.scrollWidth<=el.clientWidth)),label);
try {
 for(const [name,width,height] of [['Escritorio',1440,1000],['Tablet',820,1180],['Móvil',390,844],['Pequeño',320,740]]) {
  await page.setViewportSize({width,height});
  await page.goto(`${base}/#/oficina/personas`);
  // The initial session fetch is asynchronous; wait for either login or the Matriz.
  await page.waitForFunction(()=>document.querySelector('#login-form')||document.querySelector('.people-table'));
  if(await page.locator('#login-form').isVisible()){await page.getByLabel('Usuario',{exact:true}).fill(user.username);await page.getByLabel('Contraseña',{exact:true}).fill(user.password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();}
  await page.locator('.people-table').waitFor();
  await noOverflow(`${name}: list`);
  assert.equal(await page.locator('tbody tr').count(),20);
  await page.getByRole('button',{name:'Siguiente',exact:true}).click();
  await page.getByText(/Página 2 de 2/).first().waitFor();
  assert.ok(await page.locator('tbody tr').count()>=10);
  await page.getByRole('button',{name:'Anterior',exact:true}).click();
  await page.getByLabel('Estado',{exact:true}).selectOption('INACTIVA');
  await page.getByText('2 personas · Página 1 de 1',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Limpiar filtros',exact:true}).click();
  await page.getByRole('searchbox',{name:'Buscar personas'}).fill('alba');
  await page.getByText('1 persona · Página 1 de 1',{exact:true}).waitFor();
  await page.getByRole('link',{name:'Alba Demo Ejemplo',exact:true}).click();
  await page.getByRole('dialog').getByRole('heading',{name:'Alba Demo Ejemplo',exact:true}).waitFor();
  await noOverflow(`${name}: context`);
  await page.screenshot({path:`test-results/people-context-${name}.png`,fullPage:true});
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
  assert.equal(await page.getByRole('searchbox',{name:'Buscar personas'}).inputValue(),'alba');
  assert.equal(await page.getByRole('link',{name:'Alba Demo Ejemplo',exact:true}).evaluate(el=>el===document.activeElement),true);
  await page.getByRole('link',{name:'Alba Demo Ejemplo',exact:true}).click();
  await page.getByRole('link',{name:/Ver ficha completa/}).click();await heading('Alba Demo Ejemplo').waitFor();
  await page.getByRole('link',{name:/Volver a la Matriz/}).click();await page.locator('.people-table').waitFor();
  assert.equal(await page.getByRole('searchbox',{name:'Buscar personas'}).inputValue(),'alba');
  await page.getByRole('button',{name:'Limpiar filtros',exact:true}).click();await page.locator('.people-table').waitFor();
  await page.screenshot({path:`test-results/people-matrix-${name}.png`,fullPage:true});
  await page.getByRole('link',{name:'Nueva persona',exact:true}).click();await heading('Nueva persona').waitFor();
  await page.getByRole('button',{name:'Guardar persona',exact:true}).click();await page.getByRole('alert').waitFor();
  assert.equal(await page.locator('[name=names]').getAttribute('aria-invalid'),'true');
  await page.getByLabel('Nombres',{exact:false}).fill(`Persona ${name} Demo`);
  await page.getByLabel('Apellidos',{exact:false}).fill('Ensayo');
  await page.getByLabel('Documento',{exact:true}).fill('demo001');
  await page.getByRole('button',{name:'Guardar persona',exact:true}).click();await page.getByText('Este documento ya está registrado.',{exact:true}).waitFor();
  await page.getByLabel('Documento',{exact:true}).fill(`QA-${width}`);
  await page.getByLabel('Observaciones administrativas',{exact:true}).fill('<img src=x onerror=alert(1)> Datos ficticios de prueba.');
  await page.getByRole('button',{name:'Alternar navegación'}).click();
  if(width<=760)await page.keyboard.press('Escape');
  assert.equal(await page.getByLabel('Nombres',{exact:false}).inputValue(),`Persona ${name} Demo`);
  // Hash navigation must not discard an unsaved form when the user declines.
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('link',{name:/Volver a la Matriz/}).click();
  await page.waitForTimeout(100);
  assert.equal(await page.getByLabel('Nombres',{exact:false}).inputValue(),`Persona ${name} Demo`);
  await noOverflow(`${name}: form`);await page.screenshot({path:`test-results/people-form-${name}.png`,fullPage:true});
  await page.getByRole('button',{name:'Guardar persona',exact:true}).click();
  await heading(`Persona ${name} Demo Ensayo`).waitFor();
  await page.reload();await heading(`Persona ${name} Demo Ensayo`).waitFor();
  await page.getByRole('button',{name:'Célula',exact:true}).click();await page.getByText('Sin célula actual para mostrar.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Historial',exact:true}).click();await page.getByText('Persona creada.',{exact:true}).waitFor();
  await page.getByRole('link',{name:'Editar persona',exact:true}).click();await heading('Editar persona').waitFor();
  await page.getByLabel('Celular principal',{exact:true}).fill('000 000 1234');
  await page.getByRole('button',{name:'Guardar persona',exact:true}).click();await heading(`Persona ${name} Demo Ensayo`).waitFor();
  await page.getByRole('button',{name:'Historial',exact:true}).click();await page.getByText('Datos de contacto modificados.',{exact:true}).waitFor();
  await noOverflow(`${name}: profile history`);await page.screenshot({path:`test-results/people-profile-${name}.png`,fullPage:true});
  console.log(`${name}: list, pagination, filters, search, contextual sheet, full profile, create/edit, validation, dirty guard and history passed`);
 }
 // Concurrent editing must retain the draft and refuse to overwrite.
 await page.getByRole('link',{name:'Editar persona',exact:true}).click();await heading('Editar persona').waitFor();
 const id=page.url().split('/').at(-2);const old=await store.get(id);
 await store.save({...Object.fromEntries(Object.keys(blankPerson()).map(key=>[key,old[key]])),notes:'Actualización concurrente demo'},{actorId:'system:test-demo',id,version:old.version});
 await page.getByLabel('Celular principal',{exact:true}).fill('000000999');
 await page.getByRole('button',{name:'Guardar persona',exact:true}).click();await page.getByText(/Otra edición actualizó esta ficha/).waitFor();
 assert.equal(await page.getByLabel('Celular principal',{exact:true}).inputValue(),'000000999');
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Descartar cambios y cargar la versión actual',exact:true}).click();
 await page.getByLabel('Observaciones administrativas',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('Observaciones administrativas',{exact:true}).inputValue(),'Actualización concurrente demo');
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.getByRole('link',{name:/Volver a la Matriz/}).click();await page.locator('.people-table').waitFor();
 await page.getByRole('link',{name:'Nueva persona',exact:true}).click();await heading('Nueva persona').waitFor();
 await page.getByLabel('Nombres',{exact:false}).fill('Alba Demo');
 await page.getByLabel('Apellidos',{exact:false}).fill('Ejemplo');
 await page.getByRole('button',{name:'Guardar persona',exact:true}).click();
 await page.getByRole('checkbox',{name:/Revisé las coincidencias/}).waitFor();
 await page.getByRole('link',{name:'Alba Demo Ejemplo',exact:true}).click();
 await page.getByRole('dialog').getByRole('heading',{name:'Alba Demo Ejemplo',exact:true}).waitFor();
 await page.keyboard.press('Escape');
 await page.getByRole('checkbox',{name:/Revisé las coincidencias/}).check();
 await page.route('**/api/people',route=>route.abort());
 await page.getByRole('button',{name:'Guardar persona',exact:true}).click();
 await page.getByText('No pudimos conectar con el servidor. Tus cambios siguen en pantalla.',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('Nombres',{exact:false}).inputValue(),'Alba Demo');
 await page.unroute('**/api/people');
 // A retry after an interrupted request must still require duplicate review.
 await page.getByRole('button',{name:'Guardar persona',exact:true}).click();
 await page.getByRole('checkbox',{name:/Revisé las coincidencias/}).check();
 await page.getByRole('button',{name:'Guardar persona',exact:true}).click();
 await heading('Alba Demo Ejemplo').waitFor();
 assert.deepEqual(errors,[]);
 console.log('Concurrent editing, duplicate review, network failure/retry and draft preservation passed; no JavaScript exceptions');
} finally {await browser.close();await running.close();await f.close();}
