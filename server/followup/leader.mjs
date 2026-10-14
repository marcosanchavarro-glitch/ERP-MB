import {validRecords} from './evaluator.mjs';
import {calculate} from './policy.mjs';
// Deliberately calculate only this cell's valid records; no cross-cell history or case data.
export async function indicators(db,user,cellId,ids){if(!user.grants.some(g=>g.permission==='lider.indicadores'&&g.scope_type==='global'))return {};
 const rows=await validRecords(db,ids,cellId),groups=new Map(ids.map(id=>[id,[]]));for(const r of rows)groups.get(r.person_id).push(r);
 return Object.fromEntries(ids.map(id=>{const m=calculate(groups.get(id));return [id,{streak:m.streak,level:m.level}];}));
}
