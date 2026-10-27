import test from 'node:test';
import assert from 'node:assert/strict';
import {home} from '../src/components.js';
import {createNavigation,createLeaderNavigation} from '../src/config.js';
import {haloPortalGraphic} from '../src/ui/halo.js';
test('HALO 4: Inicio conserva shell liviano para datos autorizados de Inicio 2.0',()=>{
 const html=home(createNavigation(),{username:'Marcos'});
 assert.match(html,/Hola, <span>Marcos/);assert.match(html,/data-home-work/);
 assert.doesNotMatch(html,/halo-portal|home-more|permisos efectivos/);
});
test('HALO 4: datos opcionales inválidos nunca se convierten en texto visible',()=>{
 for(const value of [undefined,null,NaN,{},'undefined','null','NaN','[object Object]']){
  const html=home([],{username:value});assert.doesNotMatch(html,/undefined|null|NaN|\[object Object\]/);assert.match(html,/>Hola\.</);
 }
 const html=home([],{username:'<img>'});assert.doesNotMatch(html,/<img>/);assert.match(html,/&lt;img&gt;/);
});
test('HALO 4: Inicio no genera portales ni destinos planificados desde configuración',()=>{
 assert.doesNotMatch(home(createNavigation()),/href=|halo-portal/);assert.match(home([]),/data-home-work/);
});
test('HALO 4: geometrías distintas y decorativas, sin imágenes ni dependencias',()=>{
 const ids=['oficina-personas','mi-celula','multimedia','formacion','oficina-asistencia','oficina-trabajo','territorio'];
 const drawings=ids.map(haloPortalGraphic);assert.equal(new Set(drawings).size,ids.length);
 for(const html of drawings){assert.match(html,/aria-hidden="true"/);assert.doesNotMatch(html,/http|undefined|NaN|<img/);}
 assert.doesNotMatch(haloPortalGraphic('<script>'),/<script>/);
});
