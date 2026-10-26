import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {branding} from '../server/core/branding.mjs';
import {identity} from '../src/branding.js';
import {sidebar} from '../src/components.js';
import {locationMarker} from '../src/territory/markers.js';
test('HALO independiente: logo institucional solo en sede, isotipo ERP y favicon propios',()=>{
 const old=identity.logo;try{identity.logo='/src/assets/manantial-logo.png';const html=sidebar(null,null,[]);assert.ok(!html.includes('manantial-logo.png'));assert.ok(html.includes('brand-mark'));assert.ok(html.includes('HALO'));const pin=locationMarker({type:'CHURCH',coordinates:{latitude:0,longitude:0},visualResource:identity.logo});assert.ok(pin.html.includes('manantial-logo.png'));assert.equal(branding({APP_LOGO_PATH:identity.logo,APP_FAVICON_PATH:identity.logo}).favicon,'/src/favicon.svg');}finally{identity.logo=old;}
 const login=readFileSync(new URL('../src/auth/ui.js',import.meta.url),'utf8');assert.ok(!login.includes('identity.logo'));assert.ok(login.includes("icon('layers')"));
});
test('Cartografía fija: estilo claro configurado y ninguna dependencia del tema global',()=>{
 const source=readFileSync(new URL('../src/territory/maplibre-canvas.js',import.meta.url),'utf8');assert.ok(source.includes('provider.geoapify.light'));assert.ok(!source.includes('dataset.theme'));assert.ok(!source.includes('MutationObserver'));assert.ok(!source.includes('setStyle('));assert.ok(!source.includes('setPaintProperty('));
});
