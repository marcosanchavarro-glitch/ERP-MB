import test from 'node:test';
import assert from 'node:assert/strict';
import {barChart,donutChart,lineChart} from '../src/ui/charts.js';
import {home} from '../src/components.js';

test('HALO 3: gráficos sin datos, números inválidos y series insuficientes no inventan valores',()=>{
 for(const render of [barChart,donutChart,lineChart]){
  for(const rows of [[],[{label:'Sin registros',value:0}],[{label:'Incorrecto',value:NaN}],[{value:Infinity}],[{value:-1}]]){
   assert.match(render(rows),/Sin datos suficientes/);assert.doesNotMatch(render(rows),/<svg|NaN|Infinity/);
  }
 }
 assert.doesNotMatch(lineChart([{label:'Un solo día',value:3}]),/<svg/);
});
test('HALO 3: proporciones reales, enlaces de detalle y etiquetas escapadas',()=>{
 const data=[{label:'<script>',value:3,href:'#/oficina/asistencia?month=2026-10&contact=covered'},{label:'Pendientes',value:1,href:'javascript:alert(1)'}];
 const donut=donutChart(data);
 assert.match(donut,/stroke-dasharray="75 25"/);assert.match(donut,/>4<\/text>/);
 for(const render of [barChart,donutChart,lineChart]){
  const html=render(data);assert.doesNotMatch(html,/<script>|javascript:/);assert.match(html,/&lt;script&gt;/);assert.match(html,/aria-hidden="true"/);assert.match(html,/contact=covered/);
 }
 assert.match(lineChart(data),/<details><summary>Ver valores/);
});
test('HALO 3: portales salen únicamente de la navegación efectiva recibida',()=>{
 const area={id:'hdr',name:'HDR',path:'/hdr',description:'Comunidad',status:'ACTIVE',icon:'users',children:[]};
 const html=home([area],{username:'Prueba'});
 assert.match(html,/class="halo-portal"/);assert.doesNotMatch(html,/#\/oficina|#\/administracion/);
 assert.doesNotMatch(home([]),/class="halo-portal"/);
});
