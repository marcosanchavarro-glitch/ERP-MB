import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readConfig} from '../server/core/config.mjs';
import {branding} from '../server/core/branding.mjs';
import {seedDeploymentDemo,demoPassword} from '../server/demo-deployment.mjs';
import {fixture,testServer,httpClient} from './helpers.mjs';
import {identityService} from '../server/identity/service.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {createLeaderService} from '../server/leader/service.mjs';
import {grantRuntime} from '../server/db/runtime-grants.mjs';
test('Deploy: origen Render, identidad pública, paths seguros y configuración local',()=>{
 const env={DATABASE_URL:'postgresql://example.invalid/demo',SESSION_SECRET:randomBytes(48).toString('hex')};
 assert.equal(readConfig(env).host,'127.0.0.1');
 const c=readConfig({...env,NODE_ENV:'production',RENDER:'true',RENDER_EXTERNAL_URL:'https://assigned.onrender.com',APP_ENV:'demo',APP_NAME:'Otro nombre',ORGANIZATION_NAME:'Otra organización'});
 assert.equal(c.origin,'https://assigned.onrender.com');assert.equal(c.host,'0.0.0.0');assert.equal(c.branding.productName,'Otro nombre');assert.equal(c.branding.organizationName,'Otra organización');
 assert.throws(()=>branding({APP_LOGO_PATH:'https://tracking.invalid/image.png'}));assert.throws(()=>readConfig({...env,NODE_ENV:'production',APP_ORIGIN:'http://insecure.invalid'}));
});
test('Deploy: HTML escapado, configuración sin secretos, health interno y HTTPS obligatorio en API',async t=>{
 const f=await fixture();t.after(()=>f.close());const s=await testServer(f,{config:{production:true,trustProxy:'loopback',branding:branding({APP_NAME:'<img src=x onerror=alert(1)>',ORGANIZATION_NAME:'Nombre & organización',APP_ENV:'demo',SESSION_SECRET:'not-public'})}});
 assert.equal((await fetch(s.base+'/health/ready')).status,200);
 assert.equal((await fetch(s.base+'/api/auth/session')).status,400);
 const headers={'X-Forwarded-Proto':'https'};
 const html=await (await fetch(s.base+'/',{headers})).text();assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));
 const cfg=await (await fetch(s.base+'/api/installation',{headers})).json();assert.equal(cfg.environment,'demo');assert.ok(!JSON.stringify(cfg).includes('not-public'));
 assert.equal((await fetch(s.base+'/api/people',{headers})).status,401);
});
test('Deploy: seed exclusivo DEMO, datos ficticios, credenciales únicas, liderazgo y redeploy idempotente',async t=>{
 const f=await fixture();t.after(()=>f.close());const env={APP_ENV:'demo',ALLOW_DEMO_SEED:'true',DEMO_BOOTSTRAP_SECRET:randomBytes(48).toString('hex')};
 await assert.rejects(()=>seedDeploymentDemo(f.pool,{...env,APP_ENV:'production'}));
 const result=await seedDeploymentDemo(f.pool,env);assert.equal(result.accounts,8);
 assert.equal((await f.pool.query("SELECT count(*)::int n FROM people WHERE document LIKE 'DEMO-%'")).rows[0].n,8);
 const service=await identityService(f.pool),username='demo.lider',password=demoPassword(env.DEMO_BOOTSTRAP_SECRET,username),user=await service.authenticate(username,password);
 const ctx={user:await principal(f.pool,user.id)},leader=createLeaderService(f.pool);assert.equal((await leader.entry(ctx)).cells.length,1);
 const before=JSON.stringify((await f.pool.query('SELECT id,password_hash FROM users ORDER BY id')).rows);
 assert.deepEqual(await seedDeploymentDemo(f.pool,env),{skipped:true});assert.equal(JSON.stringify((await f.pool.query('SELECT id,password_hash FROM users ORDER BY id')).rows),before);
 const server=await testServer(f),api=httpClient(server.base);await api.login({username,password});assert.equal((await api.request('/api/people')).status,403);assert.equal((await api.request('/api/admin/users')).status,403);
 assert.equal((await f.pool.query("SELECT count(*)::int n FROM cell_meetings WHERE status='RECORDED'")).rows[0].n,2);
});
test('Deploy: rol web no propietario conserva permisos mínimos y no lee secretos del bootstrap',async t=>{
 const f=await fixture();t.after(()=>f.close());const role='demo_test_'+randomBytes(8).toString('hex');
 await f.pool.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`);
 try{
  await grantRuntime(f.pool,role);
  const client=await f.pool.connect();
  try{await client.query(`SET ROLE ${role}`);await client.query('SELECT id FROM users');await client.query('SELECT * FROM identity_audit');
   await assert.rejects(()=>client.query('SELECT * FROM audit_events'),e=>e.code==='42501');
   await assert.rejects(()=>client.query('DELETE FROM users'),e=>e.code==='42501');
   await assert.rejects(()=>client.query('ALTER TABLE users ADD COLUMN unsafe text'),e=>e.code==='42501');
  }finally{await client.query('RESET ROLE');client.release();}
 }finally{await f.pool.query(`DROP OWNED BY ${role}`);await f.pool.query(`DROP ROLE ${role}`);}
});
