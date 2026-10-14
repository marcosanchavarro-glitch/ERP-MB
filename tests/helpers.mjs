import {randomUUID,randomBytes} from 'node:crypto';
import {createPool} from '../server/db/pool.mjs';
import {migrate} from '../server/db/migrate.mjs';
import {createPeopleService} from '../server/people/service.mjs';
import {createAppServer} from '../server/http.mjs';
import {createUser,adminRole} from '../server/identity/service.mjs';
export async function fixture() {
 if(process.env.NODE_ENV==='production')throw new Error('Las pruebas no se ejecutan contra producción.');
 const connection=process.env.TEST_DATABASE_URL || process.env.MIGRATION_DATABASE_URL;
 if(!connection)throw new Error('Configurá TEST_DATABASE_URL o MIGRATION_DATABASE_URL para crear bases aisladas de prueba.');
 const admin=createPool({databaseUrl:connection});
 const name=`erp_test_${randomUUID().replaceAll('-','')}`;
 await admin.query(`CREATE DATABASE "${name}"`);
 const url=new URL(connection);url.pathname='/'+name;
 const pool=createPool({databaseUrl:url.href});await migrate(pool);
 const people=createPeopleService(pool),servers=new Set();
 return {pool,people,servers,url:url.href,async close(){for(const close of servers)await close();await pool.end();if(!/^erp_test_[a-f0-9]{32}$/.test(name))throw new Error('Unsafe test database name');await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);await admin.end();}};
}
export async function testServer(f,{config:overrides={},people=f.people}={}) {
 const config={mode:'test',production:false,databaseUrl:f.url,sessionSecret:randomBytes(48).toString('hex'),origin:'http://127.0.0.1:0',trustProxy:false,sessionTtl:3600000,loginLimit:100,loginWindow:60000,apiLimit:10000,...overrides};
 const server=await createAppServer(people,{pool:f.pool,config});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));config.origin=`http://127.0.0.1:${server.address().port}`;
 let closing;const close=()=>closing??=new Promise(resolve=>server.close(resolve));f.servers.add(close);
 return {server,config,base:config.origin,close};
}
export async function account(f,grants) {
 const roleId=await adminRole(f.pool),password=randomBytes(20).toString('base64url');
 const user=await createUser(f.pool,{username:'test.'+randomUUID(),password,grants:grants ?? [{roleId,scopeType:'global'}]});
 return {...user,password,roleId};
}
export function httpClient(base) {
 let cookie='',csrf='';
 async function request(path,options={}) {
  const response=await fetch(base+path,{...options,headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...options.headers}});
  const value=response.headers.getSetCookie()?.[0];if(value)cookie=value.split(';')[0];
  return response;
 }
 async function refresh(){const response=await request('/api/auth/session');const data=await response.json();csrf=data.csrfToken;return data;}
 async function login(user){await refresh();const response=await request('/api/auth/login',{method:'POST',body:JSON.stringify({username:user.username,password:user.password})});const data=await response.json();if(response.status!==200)throw new Error(data.message);csrf=data.csrfToken;return data;}
 return {request,refresh,login,get cookie(){return cookie;},get csrf(){return csrf;}};
}
