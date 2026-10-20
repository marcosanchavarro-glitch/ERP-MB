import {completeness,fields,personFieldPolicy,fieldLabels,validatePerson} from '../../src/domain/person.js';
import {cellCompletion} from '../../src/domain/cell.js';
export const problemLabels={
 ...Object.fromEntries(fields.filter(f=>personFieldPolicy[f.key]!=='optional').map(f=>['missing_'+f.key,'Sin '+f.label.toLowerCase()])),
 reported_wrong_phone:'Número incorrecto reportado por Oficina',invalid:'Datos inválidos',duplicate_document:'Posible duplicado: documento',duplicate_phone:'Teléfono compartido: revisar',duplicate_name:'Posible duplicado: nombre y apellido',memberships:'Membresías vigentes incompatibles',sex_cell:'Sexo y célula inconsistentes',active_user:'Cuenta activa vinculada a persona inactiva',
 missing_openedDate:'Sin fecha de apertura',missing_meetingDay:'Sin día de reunión',missing_meetingTime:'Sin horario',missing_leader:'Sin líder vigente'
};
export function personQuality(p,today){
 const problems=[];const add=(code,severity='warning')=>problems.push({code,label:problemLabels[code],severity});
 for(const f of fields)if(personFieldPolicy[f.key]!=='optional'&&!p[f.key])add('missing_'+f.key,personFieldPolicy[f.key]==='required'?'error':'recommended');
 const input=Object.fromEntries(fields.map(f=>[f.key,p[f.key]??null]));
 const invalid=Object.entries(validatePerson(input,today).errors).filter(([key])=>Boolean(p[key]));
 if(invalid.length)problems.push({code:'invalid',label:'Revisar '+invalid.map(([key])=>fieldLabels[key]||key).join(', '),severity:'error'});
 for(const key of ['document','phone','name'])if(Number(p['duplicate_'+key])>1)add('duplicate_'+key);
 if(p.reportedWrongPhone)add('reported_wrong_phone');
 if(p.membershipCount>1)add('memberships');
 if(p.cells.some(c=>p.sex&&c.gender!==(p.sex==='MUJER'?'F':'M')))add('sex_cell');
 if(p.activeUser&&p.status==='INACTIVA')add('active_user');
 const completion=completeness(p),review=problems.some(p=>p.severity!=='recommended');
 return {completeness:completion,problems,level:review?'review':completion.complete&&!problems.length?'complete':'incomplete',priority:problems.some(p=>p.severity==='error')?'high':review?'review':p.status==='INACTIVA'?'historical':'recommended'};
}
export function cellQuality(c){
 const completion=cellCompletion(c),problems=completion.missing.map(key=>({code:'missing_'+key,label:problemLabels['missing_'+key],severity:'recommended'}));
 if(!Number(c.leaders))problems.push({code:'missing_leader',label:problemLabels.missing_leader,severity:'warning'});
 return {completeness:{...completion,complete:!problems.length},problems,level:problems.length?'incomplete':'complete'};
}
