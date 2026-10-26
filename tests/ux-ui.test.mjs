import {test} from 'node:test';
import assert from 'node:assert/strict';
import {navigation,resolveRoute} from '../src/config.js';
import {sidebar,topbar,home,pageTitle} from '../src/components.js';
import {officeNavigationGroups,sectionDescriptions} from '../src/navigation-presentation.js';
import {themeControl} from '../src/theme-control.js';
test('UX/UI: Oficina agrupa los accesos recibidos sin duplicar ni modificar rutas',()=>{
 const office=navigation.find(a=>a.id==='oficina'),before=JSON.stringify(office),groups=officeNavigationGroups(office.children),items=groups.flatMap(g=>g.items);
 assert.deepEqual(new Set(items.map(c=>c.path)),new Set(office.children.map(c=>c.path)));assert.equal(items.length,office.children.length);assert.equal(JSON.stringify(office),before);
 for(const c of items)assert.ok(resolveRoute(c.path));assert.deepEqual(groups.map(g=>g.name),['Trabajo diario','Comunidad','Datos fundamentales','Datos y revisión']);
 const limited={...office,children:office.children.filter(c=>c.id==='oficina-personas')},html=sidebar(resolveRoute('/oficina/personas'),'oficina',[limited]);assert.match(html,/Comunidad/);assert.ok(!html.includes('Trabajo diario'));assert.ok(!html.includes('/oficina/citas'));assert.equal((html.match(/href="#\/oficina\/personas"/g)||[]).length,1);assert.ok(!html.includes('Datos fundamentales'));
});
test('UX/UI: barra simplificada conserva navegación, usuario, salida y apariencia',()=>{
 const html=topbar(resolveRoute('/oficina/personas'),{username:'<Admin>'});assert.ok(!html.includes('Próximamente'));assert.ok(!html.includes('Sesión iniciada'));assert.ok(!html.includes('Espacio de trabajo'));assert.ok(html.includes('Alternar navegación'));assert.ok(html.includes('data-action="logout"'));assert.ok(html.includes('&lt;Admin&gt;'));assert.ok(html.includes('role="switch"'));assert.ok(!html.includes('manantial-logo'));
});
test('UX/UI: switch accesible, SVG y opción automática conservada',()=>{
 const html=themeControl();assert.match(html,/type="button"[^>]*role="switch"[^>]*aria-label="Modo oscuro"[^>]*aria-checked="false"/);assert.ok(html.includes('data-icon="sun"'));assert.ok(html.includes('data-icon="moon"'));assert.ok(html.includes('value="system"'));assert.ok(html.includes('data-theme-preference-control'));
});
test('UX/UI: encabezados y descripciones reutilizados sin nuevas pantallas',()=>{
 const html=home(navigation);assert.ok(html.includes(sectionDescriptions['oficina-personas']));assert.ok(html.includes(sectionDescriptions['territorio-mapa']));assert.ok(!pageTitle('Oficina','Personas','').includes('<p></p>'));assert.ok(pageTitle('Oficina','Personas','Una oración.').includes('<p>Una oración.</p>'));assert.ok(!navigation.some(n=>n.path.includes('fundamentales')));
});
