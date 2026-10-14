// Internal building block only: the CSV upload/review/confirmation UI is intentionally deferred.
// The caller owns one transaction and must revalidate its preview before calling resolve.
import {parseCellCode} from '../../src/domain/import-normalization.js';
import {blankCell,cellCompletion} from '../../src/domain/cell.js';
import {cellAccess} from './policy.mjs';
import {createCellsService} from './service.mjs';
import {DomainError} from '../core/errors.mjs';
import {activeByCode,activeByCodes,lockCode} from './repository.mjs';
export async function previewImportCells(db,codes,context){
 if(!Array.isArray(codes)||codes.length>5000)throw new DomainError(422,'Revisá la cantidad de códigos.');
 const unique=new Map(),errors=[];
 for(const raw of codes){if(raw==null||String(raw).trim()==='')continue;const parsed=parseCellCode(raw);if(parsed.error){errors.push({raw,error:parsed.error});continue;}unique.set(parsed.code,parsed);}
 const items=[],existingCells=await activeByCodes(db,[...unique.keys()]);
 for(const parsed of unique.values()){
  const existing=existingCells.find(c=>c.displayCode===parsed.code);
  if(existing){cellAccess(context.user,'celulas.ver',existing.id);items.push({code:parsed.code,action:'REUSE',id:existing.id,completion:cellCompletion(existing)});}
  else{cellAccess(context.user,'celulas.crear');items.push({code:parsed.code,action:'CREATE',cell:{...blankCell(),...parsed.cell,openedDate:null},completion:cellCompletion(parsed.cell)});}
 }
 return {items,errors,detected:items.length,existing:items.filter(i=>i.action==='REUSE').length,toCreate:items.filter(i=>i.action==='CREATE').length};
}
export async function resolveImportCell(client,code,context){
 const parsed=parseCellCode(code);if(parsed.error)throw new DomainError(422,parsed.error);
 await lockCode(client,parsed.code);const existing=await activeByCode(client,parsed.cell);
 if(existing){cellAccess(context.user,'celulas.ver',existing.id);return {cell:existing,created:false};}
 const cell=await createCellsService(client).save({cell:{...blankCell(),...parsed.cell,openedDate:null}},{...context,client});return {cell,created:true};
}
