import {escape as e} from '../components.js';
// Neutral markup only: no records, session data or cached counts are accepted.
export const skeletonText=()=>'<span class="skeleton-shape skeleton-text"></span>';
export const skeletonAvatar=()=>'<span class="skeleton-shape skeleton-avatar"></span>';
export const skeletonCard=()=>`<div class="skeleton-card">${skeletonText()}${skeletonText()}${skeletonText()}</div>`;
export const skeletonMetric=()=>`<div class="skeleton-card skeleton-metric">${skeletonText()}${skeletonText()}</div>`;
export const skeletonPersonRow=()=>`<div class="skeleton-person">${skeletonAvatar()}<div>${skeletonText()}${skeletonText()}</div></div>`;
export const skeletonTableRow=(columns=4)=>`<tr>${Array.from({length:Math.max(1,Math.min(8,columns))},()=>`<td>${skeletonText()}</td>`).join('')}</tr>`;
const repeat=(fn,count)=>Array.from({length:count},fn).join('');
export function skeleton(kind='cards',{headers=[],rows=4}={}){
 rows=Math.max(1,Math.min(6,Number(rows)||4));
 let body;
 if(kind==='table')body=`<div class="skeleton-table-scroll"><table class="skeleton-table">${headers.length?`<thead><tr>${headers.map(h=>`<th>${e(h)}</th>`).join('')}</tr></thead>`:''}<tbody aria-hidden="true">${repeat(()=>skeletonTableRow(headers.length||4),rows)}</tbody></table></div>`;
 else if(kind==='profile')body=`<div class="skeleton-person skeleton-heading">${skeletonAvatar()}<div>${skeletonText()}${skeletonText()}</div></div><div class="skeleton-grid">${repeat(skeletonCard,4)}</div>`;
 else if(kind==='list')body=repeat(skeletonPersonRow,rows);
 else if(kind==='chart')body='<div class="skeleton-shape skeleton-chart"></div>';
 else if(kind==='dashboard')body=`${skeletonText()}<div class="skeleton-grid">${repeat(skeletonMetric,4)}</div><div class="skeleton-grid">${repeat(skeletonCard,2)}</div>${repeat(skeletonPersonRow,3)}<div class="skeleton-shape skeleton-chart"></div>`;
 else body=`<div class="skeleton-grid">${repeat(skeletonCard,rows)}</div>`;
 return `<div class="skeleton" data-skeleton="${e(kind)}" aria-busy="true"><span class="sr-only" role="status">Cargando información</span><div class="skeleton-visual" ${kind==='table'?'':'aria-hidden="true"'}>${body}</div></div>`;
}
