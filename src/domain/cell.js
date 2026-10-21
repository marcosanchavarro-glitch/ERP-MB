export const cellRoles={LEADER:'Líder',ASSISTANT:'Asistente',MEMBER:'Miembro'};
export const cellDays={'1':'Lunes','2':'Martes','3':'Miércoles','4':'Jueves','5':'Viernes','6':'Sábado','0':'Domingo'};
export const cellGenders={F:'Femenino',M:'Masculino'};
export const coordinateStates={PENDING:'Pendientes de verificar',VERIFIED:'Verificadas manualmente'};
export const cellLocationKeys=['address','locality','municipality','province','country','reference','latitude','longitude'];
export const cellCompatibilityKeys=[...cellLocationKeys,'coordinateStatus','recommendedAgeMin','recommendedAgeMax','ageUnrestricted','coverageRadiusMeters'];
export const cellFields=[
 {key:'groupCode',label:'Grupo / letra',required:true,max:1},
 {key:'generation',label:'Multiplicación',type:'number',required:true,min:1,max:9999},
 {key:'gender',label:'Sexo de célula',required:true,options:cellGenders},
 {key:'openedDate',label:'Fecha de apertura',type:'date'},
 {key:'meetingDay',label:'Día de reunión',options:cellDays},
 {key:'meetingTime',label:'Horario habitual',type:'time'},
 {key:'address',label:'Dirección',max:200},{key:'locality',label:'Localidad',max:100},
 {key:'municipality',label:'Partido / municipio',max:100},{key:'province',label:'Provincia',max:100},
 {key:'country',label:'País',max:100},{key:'reference',label:'Referencia',max:300},
 {key:'latitude',label:'Latitud',type:'number',min:-90,max:90,step:'any'},
 {key:'longitude',label:'Longitud',type:'number',min:-180,max:180,step:'any'},
 {key:'coordinateStatus',label:'Verificación de coordenadas',options:coordinateStates},
 {key:'recommendedAgeMin',label:'Edad mínima recomendada',type:'number',min:0,max:2147483647},
 {key:'recommendedAgeMax',label:'Edad máxima recomendada',type:'number',min:0,max:2147483647},
 {key:'ageUnrestricted',label:'Sin restricción etaria',type:'boolean'},
 {key:'coverageRadiusMeters',label:'Radio de referencia (metros)',type:'number',min:0,max:100000,step:'any'},
 {key:'notes',label:'Observaciones administrativas',type:'textarea',max:4000}
];
export const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'});
export const cellCode=c=>`${c.groupCode || ''}${c.generation || ''} ${c.gender || ''}`.trim();
export const blankCell=()=>Object.fromEntries(cellFields.map(f=>[f.key,f.key==='generation'?1:f.key==='gender'?'F':['number','boolean'].includes(f.type)?null:'']));
export const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&v>='1900-01-01'&&v<=today();
export const validUuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
export function validateCell(input){
 const errors={},cell={};
 if(!input||typeof input!=='object'||Array.isArray(input))return {cell,errors:{form:'Datos inválidos.'}};
 if(Object.keys(input).some(k=>!cellFields.some(f=>f.key===k)))errors.form='Campos no admitidos.';
 for(const f of cellFields){
  let v=input[f.key];
  if(f.key==='generation'){if(!Number.isInteger(v)||v<1||v>9999)errors[f.key]='Usá un número entero entre 1 y 9999.';cell[f.key]=v;continue;}
  if(f.type==='boolean'){cell[f.key]=v??null;if(v!=null&&typeof v!=='boolean')errors[f.key]='Seleccioná una opción válida.';continue;}
  if(f.type==='number'){
   cell[f.key]=v??null;
   if(v!=null&&(typeof v!=='number'||!Number.isFinite(v)||v<f.min||v>f.max||(!f.step&&!Number.isInteger(v))))errors[f.key]=`Ingresá un número válido entre ${f.min} y ${f.max}.`;
   if(f.key==='coverageRadiusMeters'&&v!=null&&v<=0)errors[f.key]='El radio debe ser mayor que cero y de hasta 100000 metros.';
   continue;
  }
  if(v!=null&&typeof v!=='string'){errors[f.key]='Usá un valor de texto.';continue;}
  v=(v || '').trim();if(f.key==='groupCode')v=v.toUpperCase();cell[f.key]=v||null;
  if(f.required&&!v)errors[f.key]='Este dato es obligatorio.';
  if(v&&(v.length>(f.max||40)||/[\u0000-\u001f]/.test(v.replace(/[\n\r\t]/g,''))))errors[f.key]='Revisá el texto y su longitud.';
  if(v&&f.options&&!Object.hasOwn(f.options,v))errors[f.key]='Seleccioná una opción válida.';
  if(v&&f.type==='date'&&!validDate(v))errors[f.key]='Ingresá una fecha válida, no futura, desde 1900.';
 }
 if(!/^\p{L}$/u.test(cell.groupCode||''))errors.groupCode='Usá una letra Unicode de grupo.';
 if(cell.meetingTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(cell.meetingTime))errors.meetingTime='Usá un horario válido.';
 if((cell.latitude==null)!==(cell.longitude==null))errors.latitude='Completá ambas coordenadas o dejá ambas vacías.';
 if(cell.coordinateStatus&&cell.latitude==null)errors.coordinateStatus='Registrá las coordenadas antes de verificarlas.';
 if(cell.latitude!=null&&cell.longitude!=null&&!cell.coordinateStatus)cell.coordinateStatus='PENDING';
 if(cell.recommendedAgeMin!=null&&cell.recommendedAgeMax!=null&&cell.recommendedAgeMin>cell.recommendedAgeMax)errors.recommendedAgeMax='La edad máxima no puede ser menor a la mínima.';
 if(cell.ageUnrestricted&&(cell.recommendedAgeMin!=null||cell.recommendedAgeMax!=null))errors.ageUnrestricted='Dejá las edades vacías si no hay restricción etaria.';
 return {cell,errors};
}

export const cellCompletion=c=>{const missing=['openedDate','meetingDay','meetingTime','address','locality'].filter(k=>!c[k]);return {complete:!missing.length,missing};};
