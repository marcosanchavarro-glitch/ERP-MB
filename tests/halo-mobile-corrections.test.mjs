import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyCell} from '../src/leader/views.js';
import {circularChartsView,chartsView} from '../src/office-work/views.js';
test('Mi Célula vacía informa ausencia de liderazgo, conserva Actualizar y no diagnostica vinculación',()=>{
 const html=emptyCell();assert.match(html,/Sin liderazgo activo/);assert.match(html,/data-leader-reload/);assert.match(html,/aria-labelledby="leader-empty-title"/);assert.doesNotMatch(html,/error|revisión|Oficina|permisos|asignación/i);
});
test('Donuts usan agregados canónicos y excluyen pendientes de la distribución de asistencia',()=>{
 const d={month:'2026-09',totals:{covered:3,pending:4,present:5,absent:2,pending_meetings:90},coverageRule:'Regla existente',charts:{daily:[],evolution:[],results:{},cells:[]},results:{}};
 const html=circularChartsView(d),totals=[...html.matchAll(/<text x="60" y="58" text-anchor="middle">(\d+)<\/text>/g)].map(m=>Number(m[1]));
 assert.deepEqual(totals,[7,7]);assert.match(html,/attendance=PRESENT/);assert.match(html,/attendance=ABSENT/);
 assert.equal((chartsView(d).match(/class="halo-chart halo-chart-donut"/g)||[]).length,2);
 assert.doesNotMatch(chartsView(d,{circular:false}),/halo-chart-donut|<h2>Cobertura mensual/);
});
