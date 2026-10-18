// Shared domain contract; server validation remains authoritative.
export const personStates = { ACTIVA: 'Activa', INACTIVA: 'Inactiva' };
export const sexes = { HOMBRE: 'Hombre', MUJER: 'Mujer' };
export const fieldGroups = [
 {id:'personal', label:'Identificación', fields:[
  {key:'names',label:'Nombres',required:true,max:100}, {key:'lastNames',label:'Apellidos',required:true,max:100},
  {key:'document',label:'Documento',max:30}, {key:'birthDate',label:'Fecha de nacimiento',type:'date'},
  {key:'sex',label:'Sexo',options:sexes}
 ]},
 {id:'contact',label:'Contacto',fields:[
  {key:'phone',label:'Celular principal',type:'tel',max:30}, {key:'alternatePhone',label:'Teléfono alternativo',type:'tel',max:30},
  {key:'email',label:'Email',type:'email',max:254}
 ]},
 {id:'address',label:'Domicilio',fields:[
  {key:'address',label:'Dirección',max:200}, {key:'locality',label:'Localidad',max:100},
  {key:'municipality',label:'Partido / municipio',max:100}, {key:'province',label:'Provincia',max:100},
  {key:'postalCode',label:'Código postal',max:15}
 ]},
 {id:'administrative',label:'Información administrativa',fields:[
  {key:'joinedDate',label:'Fecha de incorporación',type:'date'}, {key:'status',label:'Estado',required:true,options:personStates},
  {key:'notes',label:'Observaciones administrativas',type:'textarea',max:4000}
 ]}
];
export const fields = fieldGroups.flatMap(group=>group.fields);
export const fieldLabels = Object.fromEntries(fields.map(field=>[field.key,field.label]));
// Administrative completeness, not eligibility or a judgment about the person.
export const completenessFields = ['names','lastNames','document','birthDate','phone','email','address','locality'];
// Recommendations preserve the existing completeness denominator; sex is an additional quality recommendation.
export const personFieldPolicy=Object.fromEntries(fields.map(f=>[f.key,f.required?'required':completenessFields.includes(f.key)||f.key==='sex'?'recommended':'optional']));
export function completeness(person) {
 const missing = completenessFields.filter(key=>!person[key]);
 return {percent:Math.round(100*(completenessFields.length-missing.length)/completenessFields.length),missing,complete:!missing.length};
}
export const normalizeText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').replace(/\s+/g,' ').trim();
export const normalizeDocument = value => String(value || '').toUpperCase().replace(/[.\s-]/g,'');
export const normalizePhone = value => String(value || '').replace(/\D/g,'');
export const fullName = person => `${person.names} ${person.lastNames}`;
export const blankPerson = () => Object.fromEntries(fields.map(field=>[field.key,field.key==='status'?'ACTIVA':'']));
export function validatePerson(input, today = new Date().toISOString().slice(0,10)) {
 const errors = {}, person = {};
 if(!input || typeof input !== 'object' || Array.isArray(input)) return {errors:{form:'Los datos enviados no son válidos.'},person};
 for(const key of Object.keys(input)) if(!fields.some(field=>field.key===key)) errors.form='Se enviaron campos no admitidos.';
 for(const field of fields) {
  const raw = input[field.key];
  if(raw != null && typeof raw !== 'string') {errors[field.key]='Ingresá un valor de texto.';continue;}
  const value = (raw || '').trim();
  person[field.key] = value || null;
  if(field.required && !value) errors[field.key]='Este dato es obligatorio.';
  if(value.length > (field.max || 40)) errors[field.key]=`Usá hasta ${field.max || 40} caracteres.`;
  if(value && /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) errors[field.key]='El valor contiene caracteres no admitidos.';
  if(field.options && value && !Object.hasOwn(field.options,value)) errors[field.key]='Seleccioná una opción válida.';
  if(field.type==='date' && value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value || value>today || value<'1800-01-01')) errors[field.key]='Ingresá una fecha válida, no futura, desde el año 1800.';
  if(field.type==='tel' && value && (!/^[+\d\s().-]+$/.test(value) || normalizePhone(value).length<6 || normalizePhone(value).length>20)) errors[field.key]='Ingresá entre 6 y 20 dígitos.';
 }
 for(const key of ['names','lastNames']) if(person[key] && !/^[\p{L}\p{M} .’'-]+$/u.test(person[key])) errors[key]='Usá letras, espacios, apóstrofes o guiones.';
 for(const key of ['names','lastNames']) if(person[key] && !/\p{L}/u.test(person[key])) errors[key]='Ingresá al menos una letra.';
 if(person.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email)) errors.email='Ingresá un email válido.';
 if(person.document && (!/^[a-zA-Z0-9.\s-]+$/.test(person.document) || normalizeDocument(person.document).length<3)) errors.document='Ingresá al menos 3 letras o números; puede incluir puntos o guiones.';
 if(person.birthDate && person.joinedDate && person.joinedDate<person.birthDate) errors.joinedDate='La incorporación no puede ser anterior al nacimiento.';
 return {person,errors};
}
