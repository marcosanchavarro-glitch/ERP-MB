import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {grantRuntime} from '../server/db/runtime-grants.mjs';
import {saveTerritorialUnit} from '../server/territory/organization.mjs';
import {saveOuting,saveOutingRoute,outingDetail} from '../server/territory/evangelism-service.mjs';
import {evangelismStatistics} from '../server/territory/evangelism-query.mjs';
import {fixture,account,testServer} from './helpers.mjs';
import {publicUser} from '../server/identity/presentation.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {placeholder} from '../src/components.js';
import {navigation} from '../src/config.js';
import {donutChart} from '../src/ui/charts.js';
test('Territorio 1.5: navegación solo implementada, sin placeholders ni rutas duplicadas',async t=>{
 const f=await fixture();t.after(()=>f.close());const user=await account(f),projected=publicUser(await principal(f.pool,user.id)),paths=projected.access.paths.filter(p=>p.path.startsWith('/territorio'));
 for(const path of ['/territorio/mapa','/territorio/analisis','/territorio/evangelismo'])assert.ok(paths.some(p=>p.path===path));
 for(const path of ['/territorio/general','/territorio/cobertura','/territorio/iglesias'])assert.ok(!paths.some(p=>p.path===path));
 const area=navigation.find(n=>n.id==='territorio'),visible={...area,children:area.children.filter(c=>paths.some(p=>p.path===c.path))},html=placeholder({area:visible,section:visible});assert.ok(!html.includes('En preparación'));assert.ok(html.includes('Las sedes y células'));assert.ok(!html.includes('/territorio/iglesias'));
});
test('Territorio 1.5: gráficos informativos sin acciones hacia salidas no autorizadas',()=>{
 const html=donutChart([{label:'Finalizadas',value:4,href:null}]);assert.ok(!html.includes('<a '));assert.ok(html.includes('<strong>4</strong>'));assert.ok(html.includes('halo-chart-key'));
});
test('Territorio 1.5: parser comprimido maneja errores sin terminar el servidor',async t=>{
 const f=await fixture();t.after(()=>f.close());const server=await testServer(f);t.after(()=>server.close());
 const valid=gzipSync(Buffer.from('{}')),invalid=Buffer.concat([valid,Buffer.from('trailing-invalid-data')]);
 const response=await fetch(server.base+'/api/auth/login',{method:'POST',headers:{Origin:server.base,'Content-Type':'application/json','Content-Encoding':'gzip'},body:invalid});assert.ok(response.status>=400&&response.status<500);
 await new Promise(resolve=>setImmediate(resolve));assert.equal((await fetch(server.base+'/health/ready')).status,200);
});

test('Territorio 1.5: rol SQL restringido opera zonas y Evangelismo sin privilegios de propietario',async()=>{
 const f=await fixture(),role='erp_test_'+randomUUID().replaceAll('-','');let runtime;
 try{
  const user=await account(f),actor=await principal(f.pool,user.id);await f.pool.query(`CREATE ROLE ${role} NOLOGIN`);await grantRuntime(f.pool,role);runtime=new pg.Pool({connectionString:f.url,options:'-c role='+role});
  assert.equal((await runtime.query('SELECT current_user')).rows[0].current_user,role);
  let unit=null;for(const [level,name]of [['COUNTRY','Argentina'],['PROVINCE','Buenos Aires'],['MUNICIPALITY','La Matanza'],['LOCALITY','Virrey del Pino'],['ZONE','Zona'],['SECTOR','Sector']])unit=await saveTerritorialUnit(runtime,null,{level,name,parentId:unit?.id||null,geographyConfirmed:true},actor,'runtime');
  const a=await saveOuting(runtime,null,{outing:{title:'Actividad con rol restringido',date:'2026-01-01',startTime:'09:00',endTime:'10:00',responsibleId:user.id,organizer:'Oficina',participantCount:2,unitId:unit.id,description:'',notes:''}},actor,'runtime');
  await saveOutingRoute(runtime,a.id,{geometry:{type:'LineString',coordinates:[[-58.6,-34.8],[-58.601,-34.801]]},version:a.version,privacyConfirmed:true},actor,'runtime');assert.equal((await outingDetail(runtime,a.id,actor)).route.geometry.coordinates.length,2);
  assert.equal((await evangelismStatistics(runtime,{from:'2026-01-01',to:'2026-01-31'},actor)).totals.current.planned,1);
  for(const table of ['territory_units','evangelism_outings','evangelism_routes','evangelism_events'])assert.equal((await runtime.query('SELECT has_table_privilege(current_user,$1,\'DELETE\') allowed',[table])).rows[0].allowed,false);
  await assert.rejects(()=>runtime.query('UPDATE evangelism_events SET action=action'),e=>e.code==='42501');
 }finally{await runtime?.end();await f.pool.query(`DROP OWNED BY ${role}`);await f.pool.query(`DROP ROLE ${role}`);await f.close();}
});
