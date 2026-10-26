import {test} from 'node:test';
import assert from 'node:assert/strict';
import {locationTypes,markerMarkup,locationMarker,institutionalVisual} from '../src/territory/markers.js';

test('Marcadores: tipos estables, solo CHURCH y CELL habilitados',()=>{
 assert.deepEqual(Object.keys(locationTypes),['CHURCH','CELL','EVANGELISM','EVENT','POINT_OF_INTEREST']);
 for(const type of ['EVANGELISM','EVENT','POINT_OF_INTEREST','UNKNOWN'])assert.throws(()=>markerMarkup({type}),TypeError);
 const cell=markerMarkup({type:'CELL',id:'cell-1',selected:true});assert.ok(cell.includes('data-location-type="CELL"'));assert.ok(cell.includes('territory-house'));assert.ok(cell.includes('is-selected'));assert.ok(!cell.includes('<img'));
});
test('Marcadores: logo local configurable, alternativa provisional y sin recursos externos',()=>{
 const site=markerMarkup({type:'CHURCH',id:'central',visualResource:'/src/branding/official-logo.svg'});assert.ok(site.includes('src="/src/branding/official-logo.svg"'));assert.ok(site.includes('data-location-type="CHURCH"'));
 for(const resource of [null,'https://external.example/logo.svg','javascript:alert(1)','/src/../private.svg','/src/a.svg" onerror="alert(1)']){const markup=institutionalVisual(resource);assert.ok(!markup.includes('<img'));assert.ok(markup.includes('Provisional'));}
 const fallback=markerMarkup({type:'CHURCH'});assert.ok(!fallback.includes('<svg'));assert.ok(fallback.includes('Provisional'));
});
test('Marcadores: presentación conserva coordenadas/contexto, escapa identidad y no infiere tipos por nombres',()=>{
 const coordinates={latitude:-34.8,longitude:-58.6},marker=locationMarker({type:'CELL',id:'"<script>',coordinates,context:{title:'Iglesia (nombre de una célula)'},selected:true});assert.equal(marker.point,coordinates);assert.equal(marker.title,'Iglesia (nombre de una célula)');assert.ok(marker.html.includes('data-location-type="CELL"'));assert.ok(!marker.html.includes('<script>'));assert.ok(markerMarkup({type:'CELL',count:4}).includes('territory-cluster'));
});
