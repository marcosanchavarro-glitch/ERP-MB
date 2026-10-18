import {calendarToday,calendarAdd} from './calendar.js';
export function birthdayInYear(birthDate,year){
 const month=Number(birthDate.slice(5,7)),day=Number(birthDate.slice(8,10));
 const max=new Date(Date.UTC(year,month,0)).getUTCDate();
 return `${year}-${String(month).padStart(2,'0')}-${String(Math.min(day,max)).padStart(2,'0')}`;
}
// Calendar arithmetic in UTC avoids DST; "today" is the congregation's local date.
// Feb 29 is shown on Feb 28 in non-leap years, explicitly labelled in the UI.
export function nextBirthday(birthDate,from=calendarToday()){
 if(!birthDate)return null;
 const month=Number(birthDate.slice(5,7)),day=Number(birthDate.slice(8,10)),year=Number(from.slice(0,4));
 const dateFor=y=>birthdayInYear(birthDate,y);
 let date=dateFor(year);if(date<from)date=dateFor(year+1);
 return {date,days:Math.round((Date.parse(date+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000),adjusted:month===2&&day===29&&date.slice(5)!=='02-29'};
}
export function birthdayInfo(birthDate,from=calendarToday()){
 if(!birthDate||!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)||!Number.isFinite(Date.parse(birthDate))||new Date(birthDate).toISOString().slice(0,10)!==birthDate||birthDate>from||birthDate<'1800-01-01')return null;
 const next=nextBirthday(birthDate,from),year=Number(from.slice(0,4)),born=Number(birthDate.slice(0,4));
 return {...next,age:year-born-(birthdayInYear(birthDate,year)>from?1:0),turning:Number(next.date.slice(0,4))-born};
}
export const birthdayViews={today:'Hoy',tomorrow:'Mañana',week:'Esta semana',next7:'Próximos 7 días',month:'Este mes',nextMonth:'Próximo mes',all:'Todos'};
export function birthdayRange(view,from){
 if(view==='all')return null;
 if(view==='today')return [from,from];
 if(view==='tomorrow')return [calendarAdd(from,1),calendarAdd(from,1)];
 if(view==='next7')return [from,calendarAdd(from,6)];
 if(view==='week'){const start=calendarAdd(from,-((new Date(from+'T12:00:00Z').getUTCDay()+6)%7));return [start,calendarAdd(start,6)];}
 const start=view==='month'?from.slice(0,7)+'-01':new Date(Date.UTC(Number(from.slice(0,4)),Number(from.slice(5,7)),1)).toISOString().slice(0,10);
 const end=calendarAdd(new Date(Date.UTC(Number(start.slice(0,4)),Number(start.slice(5,7)),1)).toISOString().slice(0,10),-1);return [start,end];
}
export function birthdayInRange(birthDate,range){if(!range)return true;return [Number(range[0].slice(0,4)),Number(range[1].slice(0,4))].some(y=>{const date=birthdayInYear(birthDate,y);return date>=range[0]&&date<=range[1];});}
