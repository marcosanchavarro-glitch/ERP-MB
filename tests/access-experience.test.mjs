import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicUser} from '../server/identity/presentation.mjs';
import {canModule} from '../server/identity/modules.mjs';
import {capabilities} from '../server/identity/authorization.mjs';
test('Accesos: acceso general a áreas no revela Administración sin autorización administrativa',()=>{
 const user={id:'test',username:'test',grants:[{permission:'modulos.acceder',scope_type:'global'}]};
 assert.equal(canModule(user,'administracion-usuarios'),false);
 assert.equal(canModule(user,'administracion'),false);
 assert.ok(!publicUser(user).access.paths.some(p=>p.path.startsWith('/administracion')));
 assert.ok(!publicUser(user).access.paths.some(p=>['/oficina/personas','/oficina/asistencia','/oficina/dashboard'].includes(p.path)));
 user.grants.push({permission:'admin.usuarios.ver',scope_type:'global'});
 assert.ok(publicUser(user).access.paths.some(p=>p.path==='/administracion/usuarios'));
});
test('Ficha: herramientas proyectadas desde las autorizaciones existentes y Persona consultada',()=>{
 const user={grants:[{permission:'personas.ver',scope_type:'person',scope_id:'one'},{permission:'seguimiento.ver',scope_type:'person',scope_id:'one'}]};
 assert.equal(capabilities(user,'one').followup,true);
 assert.equal(capabilities(user,'other').followup,false);
 assert.equal(capabilities(user,'one').attendance,false);
 assert.equal(capabilities(user,'one').cell,false);
 assert.equal(capabilities(user,'one').account,false);
 user.grants.push({permission:'asistencia.ver',scope_type:'cell',scope_id:'cell'},{permission:'celulas.ver',scope_type:'cell',scope_id:'cell'});
 assert.equal(capabilities(user,'one').attendance,true);
 assert.equal(capabilities(user,'one').cell,true);
});
