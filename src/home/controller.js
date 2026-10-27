import {escape as e} from '../components.js';
import {sessionState} from '../auth/session.js';
import {skeleton,holdLayout} from '../ui/skeleton.js';
import {departmentStates} from '../domain/department.js';
let dispose=()=>{};
export function unmountHome(){dispose();dispose=()=>{};}
export function mountHome(root){
 unmountHome();const abort=new AbortController(),owner=sessionState.user?.id,csrf=sessionState.csrfToken;let data=null,busy=false;
 dispose=()=>abort.abort();
 const link=(path,label,cls='button secondary')=>`<a class="${cls}" href="#${e(path)}">${e(label)}</a>`;
 const section=(title,body)=>body?`<section class="dashboard-card"><h2>${e(title)}</h2>${body}</section>`:'';
 const metric=item=>`<a class="home-metric" href="#${e(item.path)}"><strong>${item.count}</strong><span>${e(item.label)}</span></a>`;
 const date=at=>new Intl.DateTimeFormat('es-AR',{dateStyle:'short',timeStyle:'short',timeZone:data.timezone}).format(new Date(at));
 const validLink=item=>item&&typeof item.label==='string'&&typeof item.path==='string'&&/^\/[\w/?=&%-]*$/.test(item.path);
 const validId=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value);
 const validDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
 function validate(result){
  if(!result||!result.sources||!Array.isArray(result.quick)||!Array.isArray(result.personal)||![...result.quick,...result.personal].every(validLink)||!Number.isFinite(Date.parse(result.generatedAt)))throw new Error('El resumen recibido está incompleto.');
  new Intl.DateTimeFormat('es-AR',{timeZone:result.timezone});
  for(const [key,source]of Object.entries(result.sources)){
   if(!['indicators','office','departments','leader'].includes(key)||!['ok','error'].includes(source.status))throw new Error('El resumen recibido está incompleto.');
   if(source.status!=='ok')continue;const d=source.data;
   if(key==='indicators'&&(!Array.isArray(d?.items)||d.items.some(i=>!validLink(i)||!Number.isFinite(i.count))))throw new Error('El resumen recibido está incompleto.');
   if(key==='office'&&(!Array.isArray(d?.widgets)||!Array.isArray(d.activity)||!Array.isArray(d.actions)||d.widgets.some(w=>typeof w.id!=='string'||typeof w.title!=='string'||!Array.isArray(w.items)||w.items.some(i=>!validLink(i)||!Number.isFinite(i.count)))||![...d.actions,...d.activity].every(validLink)||d.activity.some(i=>!validDate(i.at))))throw new Error('El resumen recibido está incompleto.');
   if(key==='departments'&&(!Number.isFinite(d?.count)||!Number.isFinite(d.upcomingCount)||!['units','upcoming','recent'].every(k=>Array.isArray(d[k]))||d.units.some(u=>!validId(u.id)||typeof u.name!=='string')||d.upcoming.some(a=>!validId(a.id)||!validId(a.unit_id)||!validDate(a.date)||typeof a.time!=='string'||typeof a.title!=='string'||typeof a.department!=='string')||d.recent.some(a=>!validId(a.activityId)||!validId(a.unitId)||!validDate(a.at)||typeof a.department!=='string')))throw new Error('El resumen recibido está incompleto.');
   if(key==='leader'&&(!Array.isArray(d?.items)||d.items.some(c=>!validId(c.id)||typeof c.displayCode!=='string'||!Number.isFinite(c.members)||c.next&&(!validId(c.next.id)||!validDate(c.next.date)||typeof c.next.time!=='string'))))throw new Error('El resumen recibido está incompleto.');
  }
 }
 root.innerHTML=`<div class="home-operational"><div class="dashboard-toolbar"><p data-home-updated></p><button type="button" class="button secondary" data-home-refresh>Actualizar Inicio</button></div><div data-home-error role="alert"></div><div data-home-results aria-live="polite">${skeleton('dashboard')}</div></div>`;
 function render(){
  const source=key=>data.sources[key]?.status==='ok'?data.sources[key].data:null,office=source('office'),departments=source('departments'),leader=source('leader'),indicators=[...(source('indicators')?.items||[])];
  if(departments)indicators.push({label:'Áreas y departamentos activos',count:departments.count,path:'/departamentos'},{label:'Actividades próximas',count:departments.upcomingCount,path:'/departamentos/calendario'});
  const follow=office?.widgets.find(w=>w.id==='followup')?.items[0];if(follow)indicators.push({...follow,label:'Seguimientos pendientes'});
  const pending=(office?.widgets||[]).flatMap(w=>w.items.filter(i=>i.count>0).map(i=>({...i,label:w.title+' · '+i.label}))),seen=new Set(),quick=[...(office?.actions||[]).slice(0,3),...data.quick].filter(a=>{const path=a.path.split('?')[0];if(seen.has(path))return false;seen.add(path);return true;}).slice(0,8);
  const personal=[...data.personal];if(departments)for(const u of departments.units)personal.push({label:u.name,path:'/departamentos/'+u.id});
  const recent=[...(office?.activity||[]),...(departments?.recent||[]).map(ev=>({label:(({DEPARTMENT_ACTIVITY_CREATE:'Actividad creada',DEPARTMENT_ACTIVITY_UPDATE:'Actividad actualizada',DEPARTMENT_ACTIVITY_STATE:'Estado de actividad actualizado'})[ev.action]||'Actividad departamental')+' · '+ev.department,at:ev.at,path:'/departamentos/'+ev.unitId+'/actividades/'+ev.activityId}))].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,8);
  const rows=items=>`<ol class="home-event-list">${items.map(i=>`<li>${link(i.path,i.label,'dashboard-event')}<time datetime="${e(i.at)}">${e(date(i.at))}</time></li>`).join('')}</ol>`;
  const upcoming=(departments?.upcoming||[]).map(a=>`<li>${link('/departamentos/'+a.unit_id+'/actividades/'+a.id,a.title,'dashboard-event')}<span>${e(a.department)} · ${e(a.date.split('-').reverse().join('/'))} · ${e(a.time)} · ${e(departmentStates[a.status]||a.status)}</span></li>`).join('');
  const myCells=(leader?.items||[]).map(c=>`<article><h3>${e(c.displayCode)}</h3><p>${c.members} integrantes</p><div class="home-links">${link('/mi-celula/'+c.id+'/integrantes','Integrantes')}${link('/mi-celula/'+c.id+'/reuniones','Historial de asistencia')}${c.next?link('/mi-celula/'+c.id+'/reuniones/'+c.next.id,'Próxima reunión · '+c.next.date.split('-').reverse().join('/')+' '+c.next.time):''}</div></article>`).join('');
  root.querySelector('[data-home-results]').innerHTML=`${Object.entries(data.sources).filter(([,s])=>s.status==='error').map(([key,s])=>`<div class="home-source-error" role="alert"><p>${e(({office:'Oficina',indicators:'Indicadores',departments:'Departamentos',leader:'Mi Célula'})[key])}: no pudimos actualizar este resumen.</p>${s.requestId?`<small>Referencia: ${e(s.requestId)}</small>`:''}<button type="button" class="button secondary" data-home-retry="${key}">Reintentar resumen</button></div>`).join('')}${indicators.length?section('Indicadores',`<div class="home-indicators">${indicators.map(metric).join('')}</div>`):''}${section('Accesos rápidos',quick.length?`<div class="home-links">${quick.map(a=>link(a.path,a.label)).join('')}</div>`:'')}<div class="home-work-grid">${section('Pendientes',pending.length?`<div class="dashboard-pending">${pending.map(i=>`<a href="#${e(i.path)}"><strong>${i.count}</strong><span>${e(i.label)}</span></a>`).join('')}</div>`:office?'<p>No tenés pendientes registrados.</p>':'')}${section('Actividad reciente',recent.length?rows(recent):'')}${section('Próximas actividades',upcoming?`<ol class="home-event-list">${upcoming}</ol>`:'')}${section('Mi espacio',personal.length||myCells?`<div class="home-links">${personal.map(a=>link(a.path,a.label)).join('')}</div>${myCells}`:'')}</div>`;
  root.querySelector('[data-home-updated]').textContent='Actualizado '+date(data.generatedAt);
 }
 async function load(source=''){
  if(busy)return;busy=true;const release=holdLayout(root),host=root.querySelector('[data-home-results]');host.setAttribute('aria-busy','true');root.querySelector('[data-home-refresh]').disabled=true;root.querySelector('[data-home-error]').replaceChildren();
  try{
   const response=await fetch('/api/home'+(source?'?source='+encodeURIComponent(source):''),{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(20000)])}),type=response.headers.get('content-type')||'';
   if(!type.includes('application/json'))throw new Error('El servidor no pudo responder. Reintentá en un momento.');const result=await response.json();
   if(abort.signal.aborted||owner!==sessionState.user?.id||csrf!==sessionState.csrfToken)return;
   if(!response.ok){if(response.status===401&&csrf===sessionState.csrfToken)window.dispatchEvent(new Event('session-expired'));throw new Error(result.message||'No pudimos actualizar Inicio.');}
   validate(result);data=source&&data?{...result,sources:{...data.sources,[source]:result.sources[source]}}:result;if(source&&!result.sources[source])delete data.sources[source];render();
  }catch(err){if(!abort.signal.aborted){if(data){if(source)delete data.sources[source];else data.sources={};render();}else host.replaceChildren();const message=err.name==='TimeoutError'?'La consulta demoró demasiado. Podés reintentar.':err instanceof TypeError?'No pudimos conectar con el servidor. Revisá la conexión y reintentá.':err.message||'No pudimos actualizar Inicio.';root.querySelector('[data-home-error]').innerHTML=`<p>${e(message)}</p><button type="button" class="button secondary" data-home-refresh>Reintentar Inicio</button>`;}}
  finally{release();busy=false;if(!abort.signal.aborted){host.removeAttribute('aria-busy');root.querySelector('[data-home-refresh]').disabled=false;}}
 }
 root.addEventListener('click',ev=>{const button=ev.target.closest('button');if(button?.hasAttribute('data-home-refresh'))load();else if(button?.dataset.homeRetry)load(button.dataset.homeRetry);},{signal:abort.signal});
 load();
}
