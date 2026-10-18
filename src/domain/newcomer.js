import {normalizeText,normalizePhone} from './person.js';
import {calendarToday} from './calendar.js';
export const newcomerStates={PENDIENTE_CONTACTO:'Pendiente de contacto',EN_SEGUIMIENTO:'En seguimiento',DERIVADO_CELULA:'Derivado a célula',EN_INTEGRACION:'En integración',LISTO_PARA_ALTA:'Listo para alta',INTEGRADO:'Integrado',ARCHIVADO:'Archivado'};
export const newcomerFields=[{key:'names',label:'Nombre',required:true,max:100},{key:'lastNames',label:'Apellido',required:true,max:100},{key:'sex',label:'Sexo',options:{HOMBRE:'Hombre',MUJER:'Mujer'}},{key:'phone',label:'Celular',max:40},{key:'address',label:'Dirección',max:200},{key:'locality',label:'Localidad',max:100},{key:'birthDate',label:'Fecha de nacimiento',type:'date'},{key:'origin',label:'Cómo llegó a la iglesia',max:500},{key:'availability',label:'Disponibilidad / horario',max:300},{key:'request',label:'Petición',type:'textarea',max:2000},{key:'notes',label:'Observaciones internas',type:'textarea',max:2000}];
export const blankNewcomer=()=>Object.fromEntries(newcomerFields.map(f=>[f.key,'']));
export function validateNewcomer(input,today=calendarToday()){
 const data={},errors={};if(!input||typeof input!=='object'||Array.isArray(input))return {data,errors:{form:'Datos inválidos.'}};
 if(Object.keys(input).some(k=>!newcomerFields.some(f=>f.key===k)))errors.form='Campos no admitidos.';
 for(const f of newcomerFields){const raw=input[f.key];if(raw!=null&&typeof raw!=='string'){errors[f.key]='Dato inválido.';continue;}const v=raw?.trim()||null;data[f.key]=v;
  if(f.required&&!v)errors[f.key]='Completá este campo.';if(v&&f.max&&v.length>f.max)errors[f.key]='Texto demasiado largo.';if(v&&f.options&&!f.options[v])errors[f.key]='Seleccioná una opción válida.';
  if(v&&f.type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v||v<'1900-01-01'||v>today))errors[f.key]='Fecha inválida.';
 }
 return {data,errors,nameKey:normalizeText([data.names,data.lastNames].join(' ')),phoneKey:normalizePhone(data.phone)};
}
export function integrationState(n){if(['ARCHIVADO','INTEGRADO'].includes(n.phase))return n.phase;if(n.attendances>=3&&n.coffeeDate)return 'LISTO_PARA_ALTA';if(n.attendances>0)return 'EN_INTEGRACION';if(n.cellId)return 'DERIVADO_CELULA';return n.phase==='EN_SEGUIMIENTO'?'EN_SEGUIMIENTO':'PENDIENTE_CONTACTO';}
