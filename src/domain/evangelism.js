import {mappable} from '../territory/geometry.js';
export const outingStates={PLANNED:'Planificada',IN_PROGRESS:'En curso',COMPLETED:'Finalizada',CANCELLED:'Cancelada'};
export const outingTransitions={PLANNED:['IN_PROGRESS','CANCELLED'],IN_PROGRESS:['COMPLETED','CANCELLED'],COMPLETED:[],CANCELLED:[]};
export const outingFields=['title','date','startTime','endTime','responsibleId','organizer','participantCount','unitId','description','notes'];
export const validCalendarDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&value>='1900-01-01'&&value<='2100-12-31'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
export function validateOuting(input){
 const errors={},value={};
 for(const [key,max,required]of [['title',160,true],['organizer',140,false],['description',2000,false],['notes',2000,false]]){const text=input?.[key]??'';if(typeof text!=='string'||text.length>max||required&&!text.trim()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))errors[key]='Revisá este campo.';else value[key]=text.trim()||null;}
 if(!validCalendarDate(input?.date))errors.date='Usá una fecha válida.';else value.date=input.date;
 for(const key of ['startTime','endTime']){const time=input?.[key]??null;if(key==='endTime'&&(time===null||time===''))value[key]=null;else if(typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))errors[key]='Usá una hora válida.';else value[key]=time;}
 if(value.startTime&&value.endTime&&value.endTime<value.startTime)errors.endTime='La finalización debe ser posterior al inicio del mismo día.';
 for(const key of ['responsibleId','unitId'])if(typeof input?.[key]!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input[key]))errors[key]='Elegí una opción válida.';else value[key]=input[key];
 const count=input?.participantCount??null;if(count!==null&&(!Number.isInteger(count)||count<0||count>100000))errors.participantCount='Indicá una cantidad entre 0 y 100000, o dejá sin informar.';else value.participantCount=count;
 return {value,errors};
}
export function routeGeometry(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['type','coordinates'].includes(k))||input.type!=='LineString'||!Array.isArray(input.coordinates)||input.coordinates.length<2||input.coordinates.length>500)throw new Error('El trazado debe tener entre 2 y 500 puntos.');
 let lengthMeters=0;const coordinates=input.coordinates.map(p=>{if(!Array.isArray(p)||p.length!==2||!mappable({latitude:p[1],longitude:p[0]}))throw new Error('Revisá las coordenadas del trazado.');return [...p];});
 for(let i=1;i<coordinates.length;i++){const [a,b]=[coordinates[i-1],coordinates[i]],r=Math.PI/180,h=Math.sin((b[1]-a[1])*r/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin((b[0]-a[0])*r/2)**2;lengthMeters+=6371008.8*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));}
 if(lengthMeters<=0||lengthMeters>1000000)throw new Error('El trazado debe tener una longitud geométrica mayor que cero y no superar 1000 km.');
 return {geometry:{type:'LineString',coordinates},lengthMeters};
}
