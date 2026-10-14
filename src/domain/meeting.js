import {today} from './cell.js';
export const meetingStates={SCHEDULED:'Programada',OPEN:'Abierta',RECORDED:'Cargada',CLOSED:'Cerrada',CANCELLED:'Cancelada'};
export const attendanceStates={PRESENT:'Presente',ABSENT:'Ausente'};
export const meetingDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&v>='1900-01-01'&&v<='2100-12-31';
export const addDays=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export const weekStart=(d=today())=>addDays(d,-((new Date(d+'T12:00:00Z').getUTCDay()+6)%7));
export const onWeek=(week,day)=>addDays(week,(Number(day)+6)%7);
export function localNow(now=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now).replace(' ','T');}
export function temporalState(meeting,now=new Date()){
 if(meeting.status==='CANCELLED')return 'Cancelada';
 if(['RECORDED','CLOSED'].includes(meeting.status))return 'Cargada';
 return meeting.date+'T'+meeting.time>localNow(now)?'Próxima':'Pendiente';
}
export function matrixMeaning(meeting,record){
 if(meeting.status==='CANCELLED')return 'Reunión cancelada';
 if(!record)return 'No correspondía';
 if(!['RECORDED','CLOSED'].includes(meeting.status))return 'Reunión no cargada';
 return attendanceStates[record.status]||'Reunión no cargada';
}
