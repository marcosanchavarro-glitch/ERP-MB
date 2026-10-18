import {createNewcomersService} from './service.mjs';
import {createCoffeeService} from './coffee.mjs';
import {createIntegrationAttendance} from './attendance.mjs';
import {createCellsService} from '../cells/service.mjs';
import {createMeetingsService} from '../meetings/service.mjs';
import {principal} from '../identity/authorization.mjs';
import {blankCell,today} from '../../src/domain/cell.js';
import {weekStart,addDays} from '../../src/domain/meeting.js';
// Explicit release seed. Never called by normal requests or a production installation.
// Existing accounts, passwords and previously completed samples are never reset.
export async function seedNewcomersDemo(pool,{demo=false}={}){
 if(!demo)throw new Error('Solo para DEMO controlada.');
 if(!(await pool.query("SELECT 1 FROM deployment.state WHERE key='demo-v1-complete'")).rowCount)throw new Error('Se requiere la DEMO ficticia inicial.');
 if((await pool.query("SELECT 1 FROM deployment.state WHERE key='newcomers-v1-complete'")).rowCount)return {skipped:true};
 const admin=(await pool.query("SELECT id FROM users WHERE username='demo.admin'")).rows[0];if(!admin)throw new Error('Falta administrador DEMO.');const ctx={user:await principal(pool,admin.id)},s=createNewcomersService(pool),coffee=createCoffeeService(pool),cells=createCellsService(pool),meetings=createMeetingsService(pool),attendance=createIntegrationAttendance(pool),start=addDays(weekStart(),-21);
 let cell=(await pool.query("SELECT * FROM cells WHERE \"groupCode\"='D' AND generation=1 AND status='ACTIVE' AND \"meetingDay\"='1' AND \"meetingTime\"='00:00' AND \"openedDate\"<=$1",[addDays(weekStart(),-14)])).rows[0];
 if(!cell){cell=(await pool.query("SELECT * FROM cells WHERE \"groupCode\"='N' AND generation=17")).rows[0];if(!cell)cell=await cells.save({cell:{...blankCell(),groupCode:'N',generation:17,openedDate:start,meetingDay:'1',meetingTime:'00:00',locality:'Localidad DEMO',notes:'DEMO 1.7: célula ficticia.'}},ctx);}
 const referralStart=cell.openedDate>start?cell.openedDate:start;
 const names=['Pendiente','Seguimiento','Derivado','Integración','Con Café','Listo para alta','Archivado'],records=[];
 for(const name of names){let n=(await pool.query("SELECT id FROM newcomers WHERE data->>'origin'='DEMO 1.7 — datos ficticios' AND data->>'names'=$1",[name])).rows[0];if(!n)n=await s.save({data:{names:name,lastNames:'Ejemplo ficticio',locality:'Localidad DEMO',origin:'DEMO 1.7 — datos ficticios'},arrivalDate:start,acknowledgeDuplicates:true},ctx);records.push(n);}
 const detail=i=>s.detail(records[i].id,{},ctx);
 if((await detail(1)).phase==='PENDIENTE_CONTACTO')await s.action(records[1].id,{action:'CONTACT',version:(await detail(1)).version,at:start+'T15:00:00Z',type:'CALL',established:true,result:'Contacto ficticio establecido'},ctx);
 for(const i of [2,3,4,5])if(!(await detail(i)).cellId)await s.refer(records[i].id,{cellId:cell.id,date:referralStart,reason:'Derivación ficticia para demostración',version:(await detail(i)).version},ctx);
 await meetings.generate({cellId:cell.id,from:referralStart,to:today()},ctx);const ms=(await meetings.list({cellId:cell.id,from:referralStart,to:today()},ctx)).items.filter(m=>['SCHEDULED','OPEN','RECORDED'].includes(m.status)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3);
 if(ms.length<3)throw new Error('La DEMO necesita tres reuniones disponibles para los ejemplos.');
 for(const [index,m] of ms.entries()){let d=await meetings.detail(m.id,ctx);if(d.status==='SCHEDULED'){await meetings.action(m.id,{action:'OPEN',version:d.version},ctx);d=await meetings.detail(m.id,ctx);}if(d.status==='OPEN')await meetings.action(m.id,{action:'SAVE',version:d.version,records:d.records.map(p=>({personId:p.personId,status:'PRESENT'}))},ctx);const roster=await attendance.roster(m.id,ctx);await attendance.save(m.id,{version:roster.version,records:roster.items.map(n=>({newcomerId:n.id,status:n.id===records[5].id||n.id===records[3].id&&index<2?'PRESENT':n.status||'ABSENT'}))},ctx);}
 let c=(await pool.query("SELECT * FROM welcome_coffees WHERE title='Café DEMO 1.7 — ficticio'")).rows[0];if(!c)c=await coffee.save(null,{date:today(),title:'Café DEMO 1.7 — ficticio',status:'REALIZADO',notes:'Datos ficticios de demostración.'},ctx);
 for(const i of [4,5]){c=await coffee.detail(c.id,{},ctx);await coffee.guest(c.id,{newcomerId:records[i].id,attended:true,version:c.version},ctx);}
 if((await detail(6)).phase!=='ARCHIVADO')await s.action(records[6].id,{action:'ARCHIVE',version:(await detail(6)).version,note:'Ejemplo ficticio de seguimiento archivado.'},ctx);
 await pool.query("INSERT INTO deployment.state VALUES('newcomers-v1-complete','true') ON CONFLICT DO NOTHING");return {skipped:false,newcomers:records.length};
}
