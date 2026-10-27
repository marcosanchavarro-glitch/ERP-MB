import {test} from 'node:test';
import assert from 'node:assert/strict';
import {navigation,resolveRoute,statuses,createNavigation} from '../src/config.js';
import {iconLibrary,isIconId,searchIcons,icon,moduleIcon} from '../src/icons.js';
import {home,placeholder,sidebar,officeLanding} from '../src/components.js';
test('Áreas, estados y rutas únicas',()=>{
 assert.equal(navigation.length,14);
 const nodes=navigation.flatMap(area=>[area,...area.children]);
 assert.equal(new Set(nodes.map(n=>n.path)).size,nodes.length);
 assert.equal(new Set(nodes.map(n=>n.id)).size,nodes.length);
 for(const node of nodes){assert.equal(resolveRoute(node.path).section,node);assert.equal(node.status,node.path==='/'||['oficina-personas','oficina-celulas','oficina-asistencia','oficina-seguimiento','oficina-cumpleanos','oficina-calidad','oficina-nuevos','oficina-importar-exportar','oficina-citas','oficina-dashboard','oficina-trabajo','oficina-cargos','oficina-areas','recepcion','departamentos','administracion-usuarios','administracion-roles','administracion-auditoria','territorio-mapa','territorio-analisis','territorio-evangelismo'].includes(node.id)?'ACTIVE':['oficina','administracion','territorio'].includes(node.id)?'DEVELOPMENT':'PLANNED');}
 assert.deepEqual(Object.keys(statuses),['PLANNED','DEVELOPMENT','ACTIVE']);
});
test('Todos los enlaces internos resuelven y los módulos pendientes tienen placeholder',()=>{
 const html=[home(),sidebar(resolveRoute('/'), 'oficina'),officeLanding(navigation.find(node=>node.id==='oficina'))];
 for(const area of navigation.slice(1)) for(const section of [area,...area.children]){if(section.status!=='PLANNED')continue;const view=placeholder({area,section});assert.match(view,/Las herramientas de esta sección todavía no están disponibles/);html.push(view);}
 for(const match of html.join('').matchAll(/href="#([^\"]+)"/g)) assert.ok(resolveRoute(match[1]),match[1]);
 assert.equal(resolveRoute('/inexistente'),null);
});
test('Estructura prevista de Oficina, Territorio y Administración',()=>{
 assert.equal(navigation.find(n=>n.id==='oficina').children.length,14);
 assert.equal(navigation.find(n=>n.id==='territorio').children.length,6);
 assert.equal(navigation.find(n=>n.id==='administracion').children.length,5);
});
test('Todos los módulos y submódulos tienen iconos válidos y predeterminados',()=>{
 const visit=nodes=>nodes.forEach(node=>{assert.ok(isIconId(node.icon),node.id);assert.ok(isIconId(node.defaultIcon),node.id);visit(node.children);});
 visit(navigation);
 assert.equal(new Set(iconLibrary.map(item=>item.id)).size,iconLibrary.length);
});
test('Preferencias serializables cambian iconos de áreas y subsecciones y permiten restaurar',()=>{
 const preferences=JSON.parse(JSON.stringify({oficina:'book','oficina-personas':'spark'}));
 const changed=createNavigation(preferences);
 const office=changed.find(node=>node.id==='oficina');
 const people=office.children.find(node=>node.id==='oficina-personas');
 assert.match(moduleIcon(office),/data-icon="book"/);
 assert.match(sidebar(resolveRoute('/'),'oficina',changed),/href="#\/oficina"[^>]*><svg[^>]+data-icon="book"/);
 assert.match(sidebar({area:office,section:people},'oficina',changed),/href="#\/oficina\/personas"[^>]*><svg[^>]+data-icon="spark"/);
 assert.equal(resolveRoute('/oficina/personas',changed).section.icon,'spark');
 assert.match(placeholder({area:office,section:people}),/class="placeholder-icon"><svg[^>]+data-icon="spark"/);
 assert.match(placeholder({area:office,section:office}),/data-icon="spark"/);
 assert.equal(createNavigation().find(node=>node.id==='oficina').icon,'office');
 assert.equal(navigation.find(node=>node.id==='oficina').children.find(node=>node.id==='oficina-personas').icon,'people');
});
test('Catálogo buscable, vista previa compartida y fallback seguro',()=>{
 assert.ok(searchIcons('MUSICA').some(item=>item.id==='music'));
 assert.ok(searchIcons('formación').some(item=>item.id==='book'));
 assert.equal(searchIcons('inexistente').length,0);
 assert.equal(searchIcons().length,iconLibrary.length);
 for(const invalid of ['constructor','__proto__','<script>',null,{}]) {
  assert.equal(isIconId(invalid),false);
  assert.match(icon(invalid),/data-icon="layers"/);
  assert.equal(createNavigation({oficina:invalid})[1].icon,'office');
 }
});
