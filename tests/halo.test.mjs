import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {home} from '../src/components.js';
import {createNavigation} from '../src/config.js';
test('HALO: Inicio conserva identidad, escapa el saludo y usa solo las herramientas suministradas',()=>{
 const modules=createNavigation().filter(a=>a.id==='multimedia').map(a=>({...a,children:a.children.filter(c=>c.id==='multimedia-fotografia')}));
 const html=home(modules,{username:'<script>Marcos</script>'});
 assert.match(html,/Hola,/);assert.match(html,/&lt;script&gt;Marcos&lt;\/script&gt;/);assert.ok(!html.includes('<script>'));
 assert.match(html,/href="#\/multimedia\/fotografia"/);assert.ok(!html.includes('href="#/oficina'));
 assert.ok(!html.includes('href="#/administracion'));assert.ok(!html.includes('scope'));assert.ok(!html.includes('permisos efectivos'));
 assert.ok(!html.includes('HALO</'));assert.ok(!html.includes('Subfase 1.3'));
});
test('HALO: fuente local WOFF2 con licencia OFL y peso acotado',()=>{
 let bytes=0;for(const file of ['archivo-latin.woff2','archivo-latin-ext.woff2']){const url=new URL('../src/assets/fonts/'+file,import.meta.url);assert.equal(readFileSync(url).toString('ascii',0,4),'wOF2');bytes+=statSync(url).size;}
 assert.ok(bytes<200000);assert.match(readFileSync(new URL('../src/assets/fonts/Archivo-OFL.txt',import.meta.url),'utf8'),/SIL Open Font License/);
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');assert.ok(!css.includes('fonts.googleapis.com'));
});
