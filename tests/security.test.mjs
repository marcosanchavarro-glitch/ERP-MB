import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {randomUUID} from 'node:crypto';
import {fixture,testServer,account,httpClient} from './helpers.mjs';
import {blankPerson} from '../src/domain/person.js';
import {revokeUserSessions,deactivateUser,createUser} from '../server/identity/service.mjs';
import {migrate} from '../server/db/migrate.mjs';
import {readConfig} from '../server/core/config.mjs';
import {profileBody} from '../src/people/views.js';
import {logRecord} from '../server/core/logger.mjs';
const person=overrides=>({...blankPerson(),names:'Persona Demo',lastNames:'Seguridad',...overrides});
async function setup(t,options){const f=await fixture(),s=await testServer(f,options);t.after(async()=>{await s.close();await f.close();});return {f,s};}
test('Login real, cookies HttpOnly/SameSite, rotación, logout y endpoints privados',async t=>{
 const {f,s}=await setup(t),user=await account(f),c=httpClient(s.base);
 for(const path of ['/api/people','/api/people/meta','/api/people/'+randomUUID(),'/api/people/'+randomUUID()+'/history'])assert.equal((await c.request(path)).status,401);
 await c.refresh();const anonymous=c.cookie;
 assert.equal((await c.request('/api/auth/login',{method:'POST',body:JSON.stringify({username:user.username,password:'incorrecta'})})).status,401);
 const response=await c.request('/api/auth/login',{method:'POST',body:JSON.stringify({username:user.username,password:user.password})});assert.equal(response.status,200);
 assert.match(response.headers.get('set-cookie'),/HttpOnly/);assert.match(response.headers.get('set-cookie'),/SameSite=Strict/);assert.notEqual(c.cookie,anonymous);
 const result=await response.json();assert.ok(!JSON.stringify(result).includes('password_hash'));assert.ok(!JSON.stringify(result).includes('sid'));
 await c.refresh();assert.equal((await c.request('/api/people')).status,200);
 const oldCookie=c.cookie;assert.equal((await c.request('/api/auth/logout',{method:'POST',body:'{}'})).status,200);
 assert.equal((await fetch(s.base+'/api/people',{headers:{Cookie:oldCookie}})).status,401);
 assert.equal((await c.request('/api/auth/register',{method:'POST',body:'{}'})).status,404);
 const hash=(await f.pool.query('SELECT password_hash FROM users WHERE id=$1',[user.id])).rows[0].password_hash;assert.match(hash,/^\$argon2id\$/);assert.notEqual(hash,user.password);
});
test('Enlaces externos abren solo la página pública; API, iframe y escrituras siguen protegidos',async t=>{
 const {f,s}=await setup(t),user=await account(f),c=httpClient(s.base);await c.login(user);
 const navigation={'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document'};
 // Native HTTP preserves Fetch Metadata exactly (fetch replaces Sec-Fetch-Mode with cors).
 const probe=(path,headers={},method='GET')=>new Promise((resolve,reject)=>{
  const req=httpRequest(new URL(path,s.base),{method,headers:{Origin:s.base,Cookie:c.cookie,'X-CSRF-Token':c.csrf,...headers}},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,type:res.headers['content-type']}));});req.on('error',reject);req.end();
 });
 for(const headers of [{},navigation]){
  const response=await probe('/',headers);assert.equal(response.status,200);assert.match(response.type,/text\/html/);
 }
 for(const [path,headers]of [
  ['/',{'Sec-Fetch-Site':'cross-site'}],
  ['/',{...navigation,'Sec-Fetch-Mode':'cors','Sec-Fetch-Dest':'empty'}],
  ['/',{...navigation,'Sec-Fetch-Dest':'iframe'}],
  ['/api/auth/session',navigation],['/api/people',navigation],['/src/app.js',navigation]
 ])assert.equal((await probe(path,headers)).status,403,path);
 for(const path of ['/','/api/auth/login','/api/auth/logout','/api/people'])assert.equal((await probe(path,navigation,'POST')).status,403,path);
 assert.equal((await c.request('/api/auth/logout',{method:'POST',headers:{Origin:'https://otro.invalid'},body:'{}'})).status,403);
 assert.equal((await c.request('/api/auth/logout',{method:'POST',headers:{'X-CSRF-Token':''},body:'{}'})).status,403);
 assert.equal((await c.request('/api/people')).status,200);
});
test('Sesiones expiradas, revocadas y usuarios inactivos no acceden',async t=>{
 const {f,s}=await setup(t),user=await account(f),c=httpClient(s.base);await c.login(user);
 await f.pool.query("UPDATE sessions SET sess=jsonb_set(sess::jsonb,'{authenticatedAt}','0')::json WHERE sess->>'userId'=$1",[user.id]);
 assert.equal((await c.request('/api/people')).status,401);
 await c.login(user);await revokeUserSessions(f.pool,user.id);assert.equal((await c.request('/api/people')).status,401);
 await c.login(user);await deactivateUser(f.pool,user.id);assert.equal((await c.request('/api/people')).status,401);
 await c.refresh();assert.equal((await c.request('/api/auth/login',{method:'POST',body:JSON.stringify({username:user.username,password:user.password})})).status,401);
});
test('Permisos y scopes: IDOR, listados, búsquedas e historial fallan cerrados',async t=>{
 const {f,s}=await setup(t);
 const a=await f.people.save(person(),{actorId:'system:test'}),b=await f.people.save(person({names:'Otra Demo',locality:'Localidad privada'}),{actorId:'system:test'});
 const roleId=randomUUID();await f.pool.query('INSERT INTO roles VALUES($1,$2)',[roleId,'Lectura limitada']);
 await f.pool.query("INSERT INTO role_permissions VALUES($1,'personas.ver'),($1,'personas.historial')",[roleId]);
 const password='Solo-pruebas-'+randomUUID();const user=await createUser(f.pool,{username:'lector.'+randomUUID(),password,grants:[{roleId,scopeType:'person',scopeId:a.id}]});
 const c=httpClient(s.base);await c.login({...user,password});
 const list=await (await c.request('/api/people')).json();assert.equal(list.total,1);assert.equal(list.items[0].id,a.id);
 assert.equal((await (await c.request('/api/people?q=Otra')).json()).total,0);
 assert.deepEqual((await (await c.request('/api/people/meta')).json()).localities,[]);
 assert.equal((await c.request('/api/people/'+a.id)).status,200);assert.equal((await c.request('/api/people/'+b.id)).status,404);
 assert.equal((await c.request('/api/people/'+b.id+'/history')).status,404);
 assert.equal((await c.request('/api/people/'+a.id,{method:'PUT',body:JSON.stringify({person:person(),version:1})})).status,403);
 assert.equal((await c.request('/api/people',{method:'POST',body:JSON.stringify({person:person()})})).status,403);
 await f.pool.query("UPDATE user_roles SET scope_type='cell' WHERE user_id=$1",[user.id]);assert.equal((await c.request('/api/people')).status,403);
});
test('CSRF, mass assignment, UUID, SQL injection, XSS y errores seguros',async t=>{
 const {f,s}=await setup(t),user=await account(f),c=httpClient(s.base);await c.login(user);
 const save=(data,headers={})=>c.request('/api/people',{method:'POST',headers,body:JSON.stringify(data)});
 assert.equal((await save({person:person()},{'X-CSRF-Token':''})).status,403);
 assert.equal((await save({person:person()},{Origin:'https://otro.invalid'})).status,403);
 assert.equal((await save({person:person({id:randomUUID(),version:900})})).status,422);
 assert.equal((await save({person:person(),actorId:'admin'})).status,422);
 assert.equal((await c.request('/api/people/not-a-uuid')).status,400);
 assert.equal((await (await c.request('/api/people?q='+encodeURIComponent("' OR 1=1 --"))).json()).total,0);
 const created=await save({person:person({notes:'<img src=x onerror=alert(1)>'})});assert.equal(created.status,201);
 const dto=await created.json();const html=profileBody(dto,'summary');assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));
 await f.pool.query('ALTER TABLE people RENAME TO temporarily_unavailable');
 const error=await c.request('/api/people');assert.equal(error.status,500);const text=await error.text();assert.ok(!/SELECT|relation|stack|password|postgresql/i.test(text));
 assert.match(error.headers.get('content-security-policy'),/script-src 'self'/);assert.equal(error.headers.get('x-content-type-options'),'nosniff');
});
test('Rate limiting de login bloquea el abuso sin autenticar',async t=>{
 const {s}=await setup(t,{config:{loginLimit:2}}),c=httpClient(s.base);await c.refresh();
 const attempt=()=>c.request('/api/auth/login',{method:'POST',body:JSON.stringify({username:'desconocido',password:'incorrecta'})});
 assert.equal((await attempt()).status,401);assert.equal((await attempt()).status,401);assert.equal((await attempt()).status,429);
});
test('Concurrencia real PostgreSQL, auditoría inmutable y rollback si falla auditoría',async t=>{
 const f=await fixture();t.after(()=>f.close());
 const a=await f.people.save(person(),{actorId:'system:test'});
 const results=await Promise.allSettled(['Primer cambio','Segundo cambio'].map(notes=>f.people.save(person({notes}),{id:a.id,version:1,actorId:'system:test'})));
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
 assert.equal(results.find(result=>result.status==='rejected').reason.details.code,'VERSION_CONFLICT');
 assert.equal((await f.people.get(a.id)).version,2);
 await assert.rejects(()=>f.pool.query("UPDATE audit_events SET action='changed'"));await assert.rejects(()=>f.pool.query('DELETE FROM audit_events'));
 await f.pool.query("CREATE FUNCTION reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'failure'; END; $$; CREATE TRIGGER reject_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_audit();");
 await assert.rejects(()=>f.people.save(person({names:'Nueva Demo'}),{actorId:'system:test'}));assert.equal((await f.people.list()).total,1);
});
test('Migraciones reproducibles, health checks y configuración de producción',async t=>{
 const {f,s}=await setup(t);await migrate(f.pool);assert.equal((await f.pool.query('SELECT * FROM schema_migrations')).rowCount,21);
 assert.equal((await fetch(s.base+'/health/live')).status,200);assert.deepEqual(await (await fetch(s.base+'/health/ready')).json(),{status:'ok'});
 const query=f.pool.query.bind(f.pool);f.pool.query=async()=>{throw new Error('secret internal detail');};
 const unavailable=await fetch(s.base+'/health/ready');assert.equal(unavailable.status,503);assert.deepEqual(await unavailable.json(),{status:'unavailable'});f.pool.query=query;
 assert.throws(()=>readConfig({NODE_ENV:'production',DATABASE_URL:'postgresql://invalid'}),/SESSION_SECRET/);
 assert.throws(()=>readConfig({NODE_ENV:'production',DATABASE_URL:'postgresql://invalid',SESSION_SECRET:randomUUID()+randomUUID(),APP_ORIGIN:'http://example.invalid'}),/HTTPS/);
});
test('Proxy HTTPS confiable, cookie Secure y rechazo de HTTP en producción',async t=>{
 const {s}=await setup(t,{config:{production:true,trustProxy:'loopback'}});
 assert.equal((await fetch(s.base+'/api/auth/session')).status,400);
 const response=await fetch(s.base+'/api/auth/session',{headers:{'X-Forwarded-Proto':'https'}});
 assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/__Host-erp.sid=/);assert.match(response.headers.get('set-cookie'),/Secure/);assert.ok(response.headers.get('strict-transport-security'));
});
test('Logs estructurados excluyen secretos, cuerpos y datos personales',()=>{
 const record=logRecord('security','test',{requestId:randomUUID(),password:'must-not-appear',cookie:'must-not-appear',token:'must-not-appear',body:{email:'private@example.invalid'},message:'must-not-appear',sql:'must-not-appear'});
 assert.ok(!/must-not-appear|private@example/.test(JSON.stringify(record)));assert.equal(record.level,'security');
});
