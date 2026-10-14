import {today} from './cell.js';
// Calendar arithmetic in UTC avoids DST; "today" is the congregation's local date.
// Feb 29 is shown on Feb 28 in non-leap years, explicitly labelled in the UI.
export function nextBirthday(birthDate,from=today()){
 if(!birthDate)return null;
 const month=Number(birthDate.slice(5,7)),day=Number(birthDate.slice(8,10)),year=Number(from.slice(0,4));
 const dateFor=y=>{const max=new Date(Date.UTC(y,month,0)).getUTCDate();return `${y}-${String(month).padStart(2,'0')}-${String(Math.min(day,max)).padStart(2,'0')}`;};
 let date=dateFor(year);if(date<from)date=dateFor(year+1);
 return {date,days:Math.round((Date.parse(date+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000),adjusted:month===2&&day===29&&date.slice(5)!=='02-29'};
}
