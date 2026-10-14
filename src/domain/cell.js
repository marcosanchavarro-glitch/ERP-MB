export const cellRoles={LEADER:'Líder',ASSISTANT:'Asistente',MEMBER:'Miembro'};
export const cellDays={'1':'Lunes','2':'Martes','3':'Miércoles','4':'Jueves','5':'Viernes','6':'Sábado','0':'Domingo'};
export const cellGenders={F:'Femenino',M:'Masculino'};
export const cellFields=[
 {key:'groupCode',label:'Grupo / letra',required:true,max:1},
 {key:'generation',label:'Multiplicación',type:'number',required:true,min:1,max:9999},
 {key:'gender',label:'Sexo de célula',required:true,options:cellGenders},
 {key:'openedDate',label:'Fecha de apertura',type:'date'},
 {key:'meetingDay',label:'Día de reunión',options:cellDays},
 {key:'meetingTime',label:'Horario habitual',type:'time'},
 {key:'address',label:'Dirección',max:200},{key:'locality',label:'Localidad',max:100},
 {key:'municipality',label:'Partido / municipio',max:100},{key:'province',label:'Provincia',max:100},
 {key:'reference',label:'Referencia',max:300},{key:'notes',label:'Observaciones administrativas',type:'textarea',max:4000}
];
export const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'});
export const cellCode=c=>`${c.groupCode || ''}${c.generation || ''} ${c.gender || ''}`.trim();
export const blankCell=()=>Object.fromEntries(cellFields.map(f=>[f.key,f.key==='openedDate'?'':f.key==='generation'?1:f.key==='gender'?'F':'']));
export const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&v>='1900-01-01'&&v<=today();
export const validUuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
export function validateCell(input){
 const errors={},cell={};
 if(!input||typeof input!=='object'||Array.isArray(input))return {cell,errors:{form:'Datos inválidos.'}};
 if(Object.keys(input).some(k=>!cellFields.some(f=>f.key===k)))errors.form='Campos no admitidos.';
 for(const f of cellFields){
  let v=input[f.key];
  if(f.key==='generation'){if(!Number.isInteger(v)||v<1||v>9999)errors[f.key]='Usá un número entero entre 1 y 9999.';cell[f.key]=v;continue;}
  if(v!=null&&typeof v!=='string'){errors[f.key]='Usá un valor de texto.';continue;}
  v=(v || '').trim();if(f.key==='groupCode')v=v.toUpperCase();cell[f.key]=v||null;
  if(f.required&&!v)errors[f.key]='Este dato es obligatorio.';
  if(v&&(v.length>(f.max||40)||/[\u0000-\u001f]/.test(v.replace(/[\n\r\t]/g,''))))errors[f.key]='Revisá el texto y su longitud.';
  if(v&&f.options&&!Object.hasOwn(f.options,v))errors[f.key]='Seleccioná una opción válida.';
  if(v&&f.type==='date'&&!validDate(v))errors[f.key]='Ingresá una fecha válida, no futura, desde 1900.';
 }
 if(!/^[A-Z]$/.test(cell.groupCode||''))errors.groupCode='Usá una letra de A a Z.';
 if(cell.meetingTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(cell.meetingTime))errors.meetingTime='Usá un horario válido.';
 return {cell,errors};
}

export const cellCompletion=c=>{const missing=['openedDate','meetingDay','meetingTime','address','locality'].filter(k=>!c[k]);return {complete:!missing.length,missing};};
