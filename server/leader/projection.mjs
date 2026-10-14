import {temporalState} from '../../src/domain/meeting.js';
// Allow-lists: never spread a Person, Cell, meeting or audit row into a portal response.
export const cellDTO=c=>({id:c.id,displayCode:c.displayCode,meetingDay:c.meetingDay,meetingTime:c.meetingTime});
export const personDTO=p=>({id:p.id,names:p.names,lastNames:p.lastNames,phone:p.phone,birthDate:p.birthDate,role:p.role});
export function meetingDTO(m){return {id:m.id,cellId:m.cellId,displayCode:m.displayCode||null,date:m.date,time:m.time,status:m.status,temporal:temporalState(m),version:m.version,notes:m.notes||null,cancellationReason:m.cancellationReason||null,
 expected:m.expected??m.records?.length??null,present:m.present??null,
 capabilities:{open:m.status==='SCHEDULED'&&temporalState(m)!=='Próxima',save:['OPEN','RECORDED'].includes(m.status)},
 ...(m.records?{records:m.records.map(p=>({personId:p.personId,names:p.names,lastNames:p.lastNames,status:p.status||null,notes:p.notes||null}))}:{})};}
