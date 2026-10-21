// Presentation of aggregates already authorized by the server; never fetches data.
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const count=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const href=value=>typeof value==='string'&&value.startsWith('#/')?e(value):'#/';
const empty=()=>'<p class="halo-chart-empty">Sin datos suficientes para graficar.</p>';
const key=(r,i)=>`<a class="halo-chart-key" href="${href(r.href)}" style="--chart-index:${i%4}"><i aria-hidden="true"></i><span>${e(r.label)}</span><strong>${r.value}</strong><span class="halo-chart-tooltip" role="tooltip">${e(r.label)}: ${r.value}</span></a>`;
export function barChart(rows){
 const data=rows.filter(r=>count(r.value));if(!data.length||!data.some(r=>r.value))return empty();
 const max=Math.max(...data.map(r=>r.value));
 return `<div class="halo-chart halo-chart-bars">${data.map((r,i)=>`<div class="halo-chart-row">${key(r,i)}<svg viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect class="halo-chart-track" width="300" height="12" rx="6"/><rect class="halo-chart-fill" width="${r.value/max*300}" height="12" rx="6" style="--chart-index:${i%4}"/></svg></div>`).join('')}<small>Comparación · escala de 0 a ${max}</small></div>`;
}
export function donutChart(rows){
 const data=rows.filter(r=>count(r.value)),total=data.reduce((n,r)=>n+r.value,0);if(!total||!Number.isFinite(total))return empty();
 let offset=0;
 const arcs=data.map((r,i)=>{const portion=r.value/total*100,start=offset;offset+=portion;return `<circle class="halo-chart-arc" cx="60" cy="60" r="46" pathLength="100" stroke-dasharray="${portion} ${100-portion}" stroke-dashoffset="${-start}" style="--chart-index:${i%4}"/>`;}).join('');
 return `<div class="halo-chart halo-chart-donut"><svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">${arcs}<text x="60" y="58" text-anchor="middle">${total}</text><text class="halo-chart-total" x="60" y="74" text-anchor="middle">TOTAL</text></svg><div>${data.map(key).join('')}</div></div>`;
}
export function lineChart(rows){
 const data=rows.filter(r=>count(r.value));
 const values=data.length?`<details><summary>Ver valores de la serie</summary>${data.map(key).join('')}</details>`:'';
 if(data.length<2||!data.some(r=>r.value))return `<div class="halo-chart">${empty()}${values}</div>`;
 const max=Math.max(...data.map(r=>r.value)),dates=data.map(r=>Date.parse(r.label));
 const temporal=dates.every(Number.isFinite)&&dates.at(-1)>dates[0];
 const point=(r,i)=>`${30+(temporal?(dates[i]-dates[0])/(dates.at(-1)-dates[0]):i/(data.length-1))*300},${110-r.value/max*90}`;
 return `<div class="halo-chart halo-chart-line"><svg viewBox="0 0 360 140" aria-hidden="true" focusable="false"><path class="halo-chart-axis" d="M30 15V110H330 M30 65H330"/><text x="2" y="24">${max}</text><text x="12" y="114">0</text><polyline points="${data.map(point).join(' ')}"/>${data.map((r,i)=>`<circle cx="${point(r,i).split(',')[0]}" cy="${point(r,i).split(',')[1]}" r="4"/>`).join('')}</svg><div class="halo-chart-endpoints"><span>${e(data[0].label)}</span><span>${e(data.at(-1).label)}</span></div>${values}</div>`;
}
// Escape dismisses hover/focus hints; the values remain available in the links/details.
if(typeof document!=='undefined'){
 document.addEventListener('keydown',event=>{if(event.key==='Escape')document.documentElement.dataset.chartTooltipDismissed='true';});
 for(const type of ['focusin','pointerover'])document.addEventListener(type,event=>{if(event.target.closest?.('.halo-chart-key'))delete document.documentElement.dataset.chartTooltipDismissed;});
}
