import {test} from 'node:test';
import assert from 'node:assert/strict';
import {haloBackdrop,haloOrbit,glassClass} from '../src/ui/halo.js';
test('HALO 2: opciones visuales acotadas, decoraciones neutras y progreso numérico seguro',()=>{
 assert.equal(glassClass('dark'),'halo-glass halo-glass--dark');
 assert.equal(glassClass('" onclick="evil'),'halo-glass halo-glass--neutral');
 const backdrop=haloBackdrop({tone:'<script>',intensity:'high',position:'left',variant:'rings'});
 assert.ok(!backdrop.includes('<script>'));assert.match(backdrop,/aria-hidden="true"/);assert.match(backdrop,/data-halo-tone="context"/);
 assert.match(haloOrbit({progress:120,decorative:false}),/aria-valuenow="100"/);
 assert.match(haloOrbit({progress:-1,decorative:false}),/stroke-dasharray="0 100"/);
 assert.ok(!haloOrbit({progress:NaN}).includes('NaN'));assert.match(haloOrbit({progress:50}),/aria-hidden="true"/);
});
