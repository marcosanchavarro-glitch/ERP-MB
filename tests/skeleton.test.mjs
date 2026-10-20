import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {skeleton,skeletonTableRow} from '../src/ui/skeleton.js';
test('Skeleton: variantes neutras, accesibles y acotadas',()=>{
 for(const kind of ['cards','list','profile','dashboard','table','chart']){const html=skeleton(kind);assert.match(html,/aria-busy="true"/);assert.match(html,/aria-hidden="true"/);assert.match(html,/role="status"/);assert.ok(!/Juan|Pérez|llamadas|0\/6/.test(html));assert.ok((html.match(/skeleton-shape/g)||[]).length<50);}
 assert.equal((skeleton('list',{rows:999}).match(/skeleton-person/g)||[]).length,6);
 assert.equal((skeletonTableRow(999).match(/<td>/g)||[]).length,8);
});
test('Skeleton: conserva encabezados conocidos y escapa etiquetas',()=>{const html=skeleton('table',{headers:['Persona','<script>'],rows:4});assert.match(html,/<th>Persona<\/th>/);assert.match(html,/&lt;script&gt;/);assert.equal((html.match(/<tr>/g)||[]).length,5);});
test('Skeleton: tokens de tema y reduced motion sin dependencia ni datos de sesión',()=>{const css=readFileSync(new URL('../src/ui/skeleton.css',import.meta.url),'utf8'),js=readFileSync(new URL('../src/ui/skeleton.js',import.meta.url),'utf8');assert.match(css,/var\(--color-surface-hover\)/);assert.match(css,/var\(--radius-panel\)/);assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/animation:none/);assert.ok(!/sessionState|localStorage|setTimeout|fetch\(/.test(js));});
