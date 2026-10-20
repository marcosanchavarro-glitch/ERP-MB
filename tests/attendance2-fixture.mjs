import {fixture,account} from './helpers.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {createCellsService} from '../server/cells/service.mjs';
import {createMeetingsService} from '../server/meetings/service.mjs';
import {createMonthlyService} from '../server/office-work/monthly.mjs';
import {createOfficeWorkService} from '../server/office-work/service.mjs';
import {createFollowupService} from '../server/followup/service.mjs';
import {blankPerson} from '../src/domain/person.js';
import {blankCell} from '../src/domain/cell.js';
export async function attendanceFixture(){const f=await fixture();try{const user=await account(f),ctx={user:await principal(f.pool,user.id)},cells=createCellsService(f.pool),meetings=createMeetingsService(f.pool),options={timezone:'America/Argentina/Buenos_Aires',now:()=>new Date('2026-10-01T15:00:00Z')},monthly=createMonthlyService(f.pool,options),work=createOfficeWorkService(f.pool,options);
 const person=async(names,phone)=>f.people.save({...blankPerson(),names,lastNames:'Ficticia',sex:'MUJER',phone},{actorId:user.id});
 const p=await person('Alba','1112345678'),late=await person('Brisa','1198765432'),waiting=await person('Cielo','1188888888');
 let a=await cells.save({cell:{...blankCell(),groupCode:'J',generation:1,gender:'F',openedDate:'2026-09-01',meetingDay:'1',meetingTime:'00:00'}},ctx),b=await cells.save({cell:{...blankCell(),groupCode:'B',generation:1,gender:'F',openedDate:'2026-09-01',meetingDay:'4',meetingTime:'00:00'}},ctx);
 async function assign(c,personId,date){return cells.move(c.id,{kind:'ASSIGN',personId,role:'MEMBER',date,version:(await cells.get(c.id)).version},ctx);}
 await assign(a,p.id,'2026-09-01');await assign(a,late.id,'2026-09-15');await assign(b,waiting.id,'2026-09-01');
 const membership=(await f.pool.query('SELECT id FROM cell_memberships WHERE "personId"=$1 AND "endDate" IS NULL',[p.id])).rows[0];
 await cells.move(a.id,{kind:'TRANSFER',personId:p.id,membershipId:membership.id,destinationId:b.id,role:'MEMBER',date:'2026-09-22',version:(await cells.get(a.id)).version},ctx);
 const moved=(await f.pool.query('SELECT id FROM cell_memberships WHERE "personId"=$1 AND "endDate" IS NULL',[p.id])).rows[0];
 await cells.move(b.id,{kind:'END',personId:p.id,membershipId:moved.id,date:'2026-09-26',reason:'Baja ficticia',version:(await cells.get(b.id)).version},ctx);
 for(const c of [a,b])await meetings.generate({cellId:c.id,from:'2026-09-01',to:'2026-09-30'},ctx);
 const list=async c=>(await meetings.list({cellId:c.id,from:'2026-09-01',to:'2026-09-30'},ctx)).items;
 async function record(c,date,status){const m=(await list(c)).find(m=>m.date===date);if(m.status==='SCHEDULED')await meetings.action(m.id,{action:'OPEN',version:m.version},ctx);const opened=await meetings.detail(m.id,ctx);return meetings.action(m.id,{action:'SAVE',version:opened.version,records:opened.records.map(r=>({personId:r.personId,status:r.personId===p.id?status:'PRESENT',notes:null}))},ctx);}
 await record(a,'2026-09-07','PRESENT');await record(a,'2026-09-14','ABSENT');await record(a,'2026-09-21','ABSENT');await record(b,'2026-09-24','ABSENT');const cancel=(await list(a)).find(m=>m.date==='2026-09-28');await meetings.action(cancel.id,{action:'CANCEL',version:cancel.version,reason:'Cancelación ficticia'},ctx);
 const follow=await createFollowupService(f.pool).open({personId:p.id,reason:'Caso ficticio de inasistencia',notes:'NOTA_PRIVADA_NO_MATRIZ'},ctx);
 await work.saveSettings(user.id,{active:true,sexes:['MUJER'],dailyGoal:6,cooldownMinutes:30,claimMinutes:15,version:0},ctx);
 return {f,user,ctx,cells,meetings,monthly,work,p,late,waiting,a,b,follow,record};}catch(error){await f.close();throw error;}
}
