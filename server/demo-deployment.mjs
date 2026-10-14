import {createHmac} from 'node:crypto';
import {createUser} from './identity/service.mjs';
import {principal} from './identity/authorization.mjs';
import {createPeopleService} from './people/service.mjs';
import {createCellsService} from './cells/service.mjs';
import {createMeetingsService} from './meetings/service.mjs';
import {blankPerson} from '../src/domain/person.js';
import {blankCell,today} from '../src/domain/cell.js';
import {weekStart,addDays} from '../src/domain/meeting.js';
export const demoAccounts=[['admin','Administrador General'],['apostol','Apóstol'],['oficina','Oficinista'],['lider','Portal líder'],['asistente','Usuario por áreas'],['miembro','Usuario por áreas'],['areas','Usuario por áreas'],['combinado','Portal líder']];
export const demoPassword=(secret,username)=>createHmac('sha256',secret).update('erp-demo-v1:'+username).digest('base64url');
export async function seedDeploymentDemo(pool,env){
 if(env.APP_ENV!=='demo'||env.ALLOW_DEMO_SEED!=='true')throw new Error('Seed exclusivo de DEMO con habilitación explícita.');
 if(!/^[a-f0-9]{96}$/.test(env.DEMO_BOOTSTRAP_SECRET||''))throw new Error('Falta secreto de bootstrap DEMO de 48 bytes.');
 await pool.query('CREATE SCHEMA IF NOT EXISTS deployment');
 await pool.query('CREATE TABLE IF NOT EXISTS deployment.state (key text PRIMARY KEY,value text NOT NULL)');
 if((await pool.query("SELECT 1 FROM deployment.state WHERE key='demo-v1-complete'")).rowCount)return {skipped:true};
 const begun=(await pool.query("SELECT 1 FROM deployment.state WHERE key='demo-v1-started'")).rowCount;
 if(!begun){
  if((await pool.query('SELECT 1 FROM people UNION ALL SELECT 1 FROM users LIMIT 1')).rowCount)throw new Error('Seed DEMO requiere una base vacía; no mezcla datos existentes.');
  await pool.query("INSERT INTO deployment.state VALUES('demo-v1-started','true')");
 }
 const people=createPeopleService(pool),cells=createCellsService(pool),meetings=createMeetingsService(pool),users={},persons={};
 for(const [key,profile] of demoAccounts){
  const username='demo.'+key;
  let person=(await pool.query('SELECT id FROM people WHERE document=$1',['DEMO-'+key.toUpperCase()])).rows[0];
  if(!person)person=await people.save({...blankPerson(),names:'Demo '+key,lastNames:'Ejemplo ficticio',document:'DEMO-'+key.toUpperCase(),birthDate:'1990'+today().slice(4),notes:'DEMO: persona ficticia. No representa a nadie real.'},{actorId:'system:demo-seed',acknowledgeDuplicates:true});
  persons[key]=person;
  let user=(await pool.query('SELECT id FROM users WHERE username=$1',[username])).rows[0];
  if(!user){const roleId=(await pool.query('SELECT id FROM roles WHERE name=$1',[profile])).rows[0].id;user=await createUser(pool,{username,password:demoPassword(env.DEMO_BOOTSTRAP_SECRET,username),personId:person.id,grants:[{roleId,scopeType:'global'}],actorId:'system:demo-seed'});}
  users[key]=user;
 }
 const ctx={user:await principal(pool,users.admin.id)},start=addDays(weekStart(),-14),cellList=[];
 for(const [index,group] of ['D','E'].entries()){
  let cell=(await pool.query('SELECT id FROM cells WHERE "groupCode"=$1 AND generation=1',[group])).rows[0];
  if(!cell)cell=await cells.save({cell:{...blankCell(),groupCode:group,generation:1,openedDate:start,meetingDay:'1',meetingTime:'00:00',locality:'Localidad DEMO',notes:'DEMO: célula ficticia.'}},ctx);
  cellList.push(cell);
  for(const [personKey,role] of (index===0?[['lider','LEADER'],['asistente','ASSISTANT'],['miembro','MEMBER']]:[['combinado','LEADER'],['areas','MEMBER']])){
   if(!(await pool.query('SELECT 1 FROM cell_memberships WHERE "personId"=$1',[persons[personKey].id])).rowCount)await cells.move(cell.id,{kind:'ASSIGN',personId:persons[personKey].id,role,date:start,version:(await cells.get(cell.id)).version},ctx);
  }
  await meetings.generate({cellId:cell.id,from:start,to:addDays(weekStart(),6)},ctx);
  const old=(await pool.query('SELECT id,status,version FROM cell_meetings WHERE "cellId"=$1 ORDER BY date LIMIT 1',[cell.id])).rows[0];
  if(old.status==='SCHEDULED')await meetings.action(old.id,{action:'OPEN',version:old.version},ctx);
  const detail=await meetings.detail(old.id,ctx);
  if(detail.status==='OPEN')await meetings.action(old.id,{action:'SAVE',version:detail.version,records:detail.records.map((p,i)=>({personId:p.personId,status:i===0?'ABSENT':'PRESENT'}))},ctx);
 }
 for(const key of ['areas','combinado'])await pool.query("INSERT INTO user_permissions(id,user_id,permission,scope_type,scope_id) VALUES(gen_random_uuid(),$1,'modulos.acceder','subarea','multimedia-fotografia') ON CONFLICT DO NOTHING",[users[key].id]);
 await pool.query("INSERT INTO deployment.state VALUES('demo-v1-complete','true')");
 return {skipped:false,accounts:demoAccounts.length,cells:cellList.length};
}
