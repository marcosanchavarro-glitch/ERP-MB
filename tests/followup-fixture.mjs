import {fixture,account} from './helpers.mjs';
import {principal} from '../server/identity/authorization.mjs';
import {createCellsService} from '../server/cells/service.mjs';
import {createMeetingsService} from '../server/meetings/service.mjs';
import {createFollowupService} from '../server/followup/service.mjs';
import {blankPerson} from '../src/domain/person.js';
import {blankCell} from '../src/domain/cell.js';
import {weekStart,addDays} from '../src/domain/meeting.js';
export async function setup(t){const f=await fixture();if(t)t.after(()=>f.close());const user=await account(f),ctx={user:await principal(f.pool,user.id)},cells=createCellsService(f.pool),meetings=createMeetingsService(f.pool),followup=createFollowupService(f.pool),start=addDays(weekStart(),-112);let n=0,cellNumber=0;
 const person=async()=>f.people.save({...blankPerson(),names:'Persona '+String.fromCharCode(65+n++),lastNames:'Seguimiento'},{actorId:user.id,acknowledgeDuplicates:true});
 const cell=async()=>cells.save({cell:{...blankCell(),groupCode:'J',generation:++cellNumber,openedDate:start,meetingDay:'1',meetingTime:'00:00'}},ctx);
 const p=await person(),c=await cell();
 const assign=async(c,p,date=start)=>cells.move(c.id,{kind:'ASSIGN',personId:p.id,role:'MEMBER',date,version:(await cells.get(c.id)).version},ctx);
 await assign(c,p);
 async function record(i,status='ABSENT',cell=c){const date=addDays(start,i*7);await meetings.generate({cellId:cell.id,from:date,to:addDays(date,6)},ctx);let m=(await meetings.list({cellId:cell.id,from:date,to:addDays(date,6)},ctx)).items[0];if(m.status==='SCHEDULED')await meetings.action(m.id,{action:'OPEN',version:m.version},ctx);m=await meetings.detail(m.id,ctx);return meetings.action(m.id,{action:'SAVE',version:m.version,records:m.records.map(p=>({personId:p.personId,status}))},ctx);}
 const view=()=>followup.person(p.id,ctx);return {f,user,ctx,cells,meetings,followup,start,p,c,person,cell,assign,record,view};
}
