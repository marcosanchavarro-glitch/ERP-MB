import test from 'node:test';
import assert from 'node:assert/strict';
import {home} from '../src/components.js';
import {createNavigation,createLeaderNavigation} from '../src/config.js';
import {haloPortalGraphic} from '../src/ui/halo.js';
test('HALO 4: Inicio agrupa destinos disponibles sin repetir navegación editorial',()=>{
 const html=home(createNavigation(),{username:'Marcos'});
 assert.doesNotMatch(html,/Tu próximo paso|Espacios para servir|Cada área, un propósito|home-tool-number|area-item/);
 const paths=[...html.matchAll(/class="halo-portal" href="#([^"]+)"/g)].map(m=>m[1]);
 assert.equal(paths.length,16);assert.equal(new Set(paths).size,paths.length);assert.ok(paths.includes('/territorio/mapa'));
 assert.ok(paths.includes('/oficina/personas'));assert.ok(!paths.includes('/comedor'));assert.match(html,/<details class="home-more">/);
 assert.match(html,/data-home-work/);
});
test('HALO 4: datos opcionales inválidos nunca se convierten en texto visible',()=>{
 for(const value of [undefined,null,NaN,{},'undefined','null','NaN','[object Object]']){
  const html=home([{...createLeaderNavigation(),description:value}],{username:value});
  assert.doesNotMatch(html,/undefined|null|NaN|\[object Object\]/);assert.match(html,/Mi Célula/);
 }
 const html=home([{...createLeaderNavigation(),description:'<script>malo</script>'}],{username:'<img>'});
 assert.doesNotMatch(html,/<script>|<img>/);assert.match(html,/&lt;script&gt;/);
});
test('HALO 4: pocos accesos no incluyen módulos ajenos ni hosts operativos vacíos',()=>{
 const node={...createLeaderNavigation()};const html=home([node]);
 assert.doesNotMatch(html,/data-home-work|oficina|administracion/);assert.equal((html.match(/class="halo-portal"/g)||[]).length,1);
 const planned=createNavigation().filter(n=>n.id==='multimedia');assert.doesNotMatch(home(planned),/class="halo-portal"|data-home-work/);
});
test('HALO 4: geometrías distintas y decorativas, sin imágenes ni dependencias',()=>{
 const ids=['oficina-personas','mi-celula','multimedia','formacion','oficina-asistencia','oficina-trabajo','territorio'];
 const drawings=ids.map(haloPortalGraphic);assert.equal(new Set(drawings).size,ids.length);
 for(const html of drawings){assert.match(html,/aria-hidden="true"/);assert.doesNotMatch(html,/http|undefined|NaN|<img/);}
 assert.doesNotMatch(haloPortalGraphic('<script>'),/<script>/);
});
