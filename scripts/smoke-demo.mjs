// Explicit public DEMO smoke. Never run against local or production data.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const base='https://erp-mb-demo.onrender.com';
const range='?from='+new Date(Date.now()-28*86400000).toISOString().slice(0,10)+'&to='+new Date().toISOString().slice(0,10);
const credentials=JSON.parse(await readFile('.local/render-demo-credentials.json','utf8'));
let checks=0;
function ok(value,label){assert.ok(value,label);checks++;console.log('PASS '+label);}
function client(){let cookie='',csrf='';return {get cookie(){return cookie;},async req(path,options={}){
 const r=await fetch(base+path,{...options,signal:AbortSignal.timeout(45000),headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...options.headers}});
 const set=r.headers.getSetCookie()[0];if(set){cookie=set.split(';')[0];if(!set.includes('Expires=Thu, 01 Jan 1970'))ok(set.includes('Secure')&&set.includes('HttpOnly')&&set.includes('SameSite=Strict')&&set.startsWith('__Host-'),'secure cookie');}
 return r;
 },async json(path,status=200,options={}){const r=await this.req(path,options);ok(r.status===status,path+' HTTP '+status);const data=await r.json();if(data.csrfToken)csrf=data.csrfToken;return data;},async login(username){const account=credentials.accounts.find(a=>a.username===username);await this.json('/api/auth/session');return this.json('/api/auth/login',200,{method:'POST',body:JSON.stringify({username,password:account.password})});}};}
const publicClient=client();
const identity=await publicClient.json('/api/installation');ok(identity.environment==='demo','DEMO identity');
await publicClient.json('/health/ready');
for(const path of ['/','/src/app.js','/src/styles.css','/src/favicon.svg']){const r=await publicClient.req(path);ok(r.status===200,path+' asset');ok(Boolean(r.headers.get('content-security-policy')),'CSP present');}
await publicClient.json('/api/people',401);
await publicClient.json('/api/auth/login',403,{method:'POST',body:'{}',headers:{'X-CSRF-Token':'invalid'}});
await publicClient.json('/api/auth/login',403,{method:'POST',body:'{}',headers:{Origin:'https://foreign.invalid'}});
const admin=client();await admin.login('demo.admin');
const people=await admin.json('/api/people'),cells=await admin.json('/api/cells'),users=await admin.json('/api/admin/users'),meetings=await admin.json('/api/meetings'+range);
ok(people.items.length===8&&cells.items.length===2&&users.items.length===8,'fictitious dataset counts');
ok(meetings.items.some(m=>m.status==='RECORDED'),'historical attendance exists');
for(const c of cells.items){await admin.json('/api/meetings/matrix/'+c.id);await admin.json('/api/cells/'+c.id+'/members');}
const leader=client();await leader.login('demo.lider');const entry=await leader.json('/api/leader');ok(entry.cells.length===1,'leader single cell');
const own=entry.cells[0].id,other=cells.items.find(c=>c.id!==own).id;
await leader.json('/api/leader/cells/'+own);const members=await leader.json('/api/leader/cells/'+own+'/members');const history=await leader.json('/api/leader/cells/'+own+'/meetings');
ok(history.items.length>0,'leader history');
const foreign=people.items.find(p=>!members.items.some(m=>m.id===p.id));
for(const path of ['/api/leader/cells/'+other,'/api/leader/cells/'+own+'/people/'+foreign.id]){const r=await leader.req(path);ok([403,404].includes(r.status),'IDOR denied '+path);}
for(const path of ['/api/admin/users','/api/meetings/matrix/'+other])await leader.json(path,403);
for(const username of ['demo.oficina','demo.apostol','demo.asistente','demo.miembro','demo.areas','demo.combinado']){
 const c=client();await c.login(username);
 if(['demo.oficina','demo.apostol'].includes(username))await c.json('/api/people');
 if(['demo.asistente','demo.miembro','demo.areas'].includes(username))await c.json('/api/leader',403);
 if(['demo.areas','demo.combinado'].includes(username))await c.json('/api/modules/multimedia-fotografia/access');
 if(username==='demo.combinado')ok((await c.json('/api/leader')).cells.length===1,'combined leader and area');
 await c.json('/api/auth/logout',200,{method:'POST',body:'{}'});
}
const member=client();await member.login('demo.miembro');
const target=users.items.find(u=>u.username==='demo.miembro');
async function setActive(active){const d=await admin.json('/api/admin/users/'+target.id);return admin.json('/api/admin/users/'+target.id,200,{method:'PUT',body:JSON.stringify({version:d.user.version,username:d.user.username,personId:d.user.person_id,active,profileIds:d.roles.filter(r=>r.scope_type==='global').map(r=>r.roleId),retainedRoleIds:d.roles.filter(r=>r.scope_type!=='global').map(r=>r.id),permissions:d.explicit,confirmPassword:credentials.accounts.find(a=>a.username==='demo.admin').password})});}
try{await setActive(false);const s=await member.json('/api/auth/session');ok(!s.authenticated,'suspension revokes session');}finally{await setActive(true);}
await member.login('demo.miembro');await member.json('/api/auth/logout',200,{method:'POST',body:'{}'});
ok(!(await member.json('/api/auth/session')).authenticated,'logout ends authentication');
await writeFile('.local/demo-redeploy-session.json',JSON.stringify({cookie:admin.cookie,range,counts:{people:people.items.length,cells:cells.items.length,users:users.items.length,meetings:meetings.items.length}}));
console.log(JSON.stringify({checks,status:'PASS',base}));
