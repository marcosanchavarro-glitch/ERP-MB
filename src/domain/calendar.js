export const defaultTimezone='America/Argentina/Buenos_Aires';
export function validTimezone(value=defaultTimezone){new Intl.DateTimeFormat('en',{timeZone:value}).format();return value;}
export function calendarToday(timeZone=defaultTimezone,now=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${values.year}-${values.month}-${values.day}`;
}
export const calendarAdd=(date,days)=>new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
