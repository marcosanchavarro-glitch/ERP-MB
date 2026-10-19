// Normalizers for a future preview/confirm importer; they do not write data.
import {normalizeText,normalizeDocument,normalizePhone} from './person.js';
export function normalizePersonSex(raw){
 if(raw==null||raw==='')return {value:null,error:null};
 if(typeof raw!=='string')return {value:null,error:'Sexo no interpretable.'};
 const key=normalizeText(raw);if(!key)return {value:null,error:null};
 const values={hombre:'HOMBRE',masculino:'HOMBRE',h:'HOMBRE',male:'HOMBRE',mujer:'MUJER',femenino:'MUJER',f:'MUJER',female:'MUJER'};
 return Object.hasOwn(values,key)?{value:values[key],error:null}:{value:null,error:'Sexo ambiguo o no reconocido. Revisar antes de importar.'};
}
export function parseCellCode(raw){
 if(typeof raw!=='string')return {cell:null,error:'El código debe ser texto.'};
 const match=raw.trim().normalize('NFC').toUpperCase().match(/^(\p{L})\s*([1-9]\d{0,3})\s*([FM])$/u);
 if(!match)return {cell:null,error:'Código inválido. Usá una letra Unicode de grupo, número 1–9999 y F/M (por ejemplo J1 F).'};
 const cell={groupCode:match[1],generation:Number(match[2]),gender:match[3]};return {cell,code:`${cell.groupCode}${cell.generation} ${cell.gender}`,error:null};
}
export function sexCellWarning(personSex,cellGender){return (personSex==='HOMBRE'&&cellGender==='F')||(personSex==='MUJER'&&cellGender==='M')?'El sexo de la persona no coincide con el tipo de célula.':null;}

export const personImportSignals=row=>({document:normalizeDocument(row.document)||null,phone:normalizePhone(row.phone)||null,name:normalizeText([row.names,row.lastNames].filter(Boolean).join(' '))||null});
