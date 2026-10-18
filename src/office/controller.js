import {mountDashboard} from './dashboard.js';
import {escape as e,pageTitle} from '../components.js';
import {personLink} from '../people/views.js';
import {cellRoles} from '../domain/cell.js';
import {birthdayViews} from '../domain/birthday.js';
import {personStates,sexes} from '../domain/person.js';
import {sessionState} from '../auth/session.js';
const states={birthdays:{q:'',view:'today',status:'ACTIVA',sex:'',cellId:'',month:'',minAge:'',maxAge:'',page:1,scroll:0},quality:{q:'',status:'ACTIVA',cellId:'',completeness:'',problem:'all',page:1,tab:'people',scroll:0}};
let dispose=()=>{},owner;
export const officeRoute=path=>({'/oficina/cumpleanos':'birthdays','/oficina/calidad':'quality','/oficina/dashboard':'dashboard'}[path.split('?')[0]]||null);
export function unmountOffice(){dispose();dispose=()=>{};}
const dateLabel=value=>value?value.split('-').reverse().join('/'):'—';
const linkCell=c=>`<a href="#/oficina/celulas/${e(c.id)}" data-cell-id="${e(c.id)}">${e(c.displayCode)}</a>`;
const cellsLabel=cells=>cells.length?cells.map(c=>`${linkCell(c)} · ${e(cellRoles[c.role]||'')}`).join('<br>'):'Sin célula visible';
async function api(path){const r=await fetch('/api/office/'+path);const d=await r.json();if(!r.ok){if(r.status===401)window.dispatchEvent(new Event('session-expired'));throw new Error(d.message||'No pudimos cargar la consulta.');}return d;}
export function mountOffice(root,kind){
 unmountOffice();
 if(kind==='dashboard'){dispose=mountDashboard(root);return;}
 if(owner!==sessionState.user.id){for(const s of Object.values(states)){s.q='';s.cellId='';s.page=1;s.scroll=0;s.status='ACTIVA';}states.quality.tab='people';owner=sessionState.user.id;}
 const initial=new URLSearchParams(location.hash.split('?')[1]||'');if(initial.size){const s=states[kind];s.page=1;s.scroll=0;s.q='';s.cellId='';if(kind==='birthdays')Object.assign(s,{sex:'',month:'',minAge:'',maxAge:''});s.status=kind==='quality'&&initial.get('tab')==='cells'?'ACTIVE':'ACTIVA';s.problem='all';s.completeness='';if(kind==='birthdays'&&birthdayViews[initial.get('view')])s.view=initial.get('view');if(kind==='quality'){s.tab=initial.get('tab')==='cells'?'cells':'people';if(['duplicates','missing_leader'].includes(initial.get('problem')))s.problem=initial.get('problem');if(initial.get('completeness')==='incomplete')s.completeness='incomplete';}}
 const state=states[kind],birthday=kind==='birthdays';let active=true,serial=0,data;
 const available=sessionState.user.access.officeQuality||{};
 if(!birthday&&!available[state.tab]){state.tab=available.people?'people':'cells';state.status=state.tab==='cells'?'ACTIVE':'ACTIVA';}
 const controls=new AbortController(),on=(type,fn)=>root.addEventListener(type,fn,{signal:controls.signal});
 // Backend is authoritative; tabs may be requested even when only one dataset is authorized.
 dispose=()=>{active=false;serial++;state.scroll=window.scrollY;controls.abort();};
 const select=(name,label,options,empty='Todos')=>`<label>${e(label)}<select name="${name}" aria-label="${e(label)}">${empty!==null?`<option value="">${e(empty)}</option>`:''}${Object.entries(options).map(([v,label])=>`<option value="${e(v)}" ${String(state[name])===v?'selected':''}>${e(label)}</option>`).join('')}</select></label>`;
 function shell(){const cell=state.tab==='cells'&&!birthday;
  root.innerHTML=`${pageTitle('OFICINA MANANTIAL',birthday?'Cumpleaños':'Calidad de datos',birthday?'Consultá próximos cumpleaños y abrí la Ficha 360°.':'Detectá información pendiente y revisá coincidencias. No se modifican datos automáticamente.')}
  ${birthday?'':`<nav class="insight-tabs" aria-label="Calidad">${available.people?`<button class="button secondary" data-tab="people" aria-pressed="${!cell}">Personas</button>`:''}${available.cells?`<button class="button secondary" data-tab="cells" aria-pressed="${cell}">Células</button>`:''}</nav>`}
  <form class="insight-filters" aria-label="Filtros de consulta"><label>Buscar ${cell?'célula':'persona'}<input name="q" type="search" maxlength="150" value="${e(state.q)}"></label>
  ${birthday?select('view','Período',birthdayViews,null):''}
  ${select('status','Estado',cell?{ACTIVE:'Activa',CLOSED:'Cerrada'}:personStates)}
  ${!cell?select('cellId','Célula',Object.fromEntries((data?.cells||[]).map(c=>[c.id,c.displayCode]))):''}
  ${birthday?`${select('sex','Sexo',sexes)}${select('month','Mes de nacimiento',Object.fromEntries(Array.from({length:12},(_,i)=>[i+1,new Intl.DateTimeFormat('es',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2020,i,1)))])))}<label>Edad desde<input name="minAge" type="number" min="0" max="250" value="${e(state.minAge)}"></label><label>Edad hasta<input name="maxAge" type="number" min="0" max="250" value="${e(state.maxAge)}"></label>`:select('completeness','Completitud',{complete:'Completa',incomplete:'Incompleta'})}
  ${birthday?'':select('problem','Problema',{all:'Todos',incomplete:'Ficha incompleta',complete:'Ficha completa',review:'Requiere revisión',...(!cell?{duplicates:'Posibles duplicados'}:{}),...(data?.problemLabels||{})},null)}
  <button class="button" type="submit">Aplicar filtros</button><button class="button secondary" type="button" data-reset>Limpiar</button></form>
  <div data-insight-summary></div><div data-insight-results aria-live="polite">Cargando…</div>
  <p class="matrix-help">${birthday?'29/02: se considera el 28/02 en años no bisiestos. Próximos 7 días incluye hoy. Semana de lunes a domingo.':'Completitud administrativa, no valoración de la persona. Los teléfonos pueden compartirse entre familiares. Las fichas inactivas se consultan por separado mediante Estado.'}</p>`;
 }
 function render(){const cell=state.tab==='cells'&&!birthday;const target=root.querySelector('[data-insight-results]');
  if(!birthday){const s=data.summary;const labels={all:'Total',complete:'Completas',incomplete:'Incompletas',review:'Requieren revisión',...(!cell?{duplicates:'Posibles duplicados'}:{})};
   root.querySelector('[data-insight-summary]').innerHTML=`<div class="insight-summary">${Object.entries(labels).map(([key,label])=>`<button class="button secondary" data-problem="${key}" aria-pressed="${state.problem===key}">${e(label)}: ${key==='all'?s.total:s[key]}</button>`).join('')}${Object.entries(s.problems).map(([key,n])=>`<button class="button secondary" data-problem="${e(key)}">${e(data.problemLabels[key])}: ${n}</button>`).join('')}</div>${!cell?`<p>Completitud media: <strong>${s.average===null?'Sin registros':s.average+'%'}</strong>. Usa los 8 campos de la ficha; sexo se revisa por separado. Promedio de las fichas incluidas en búsqueda, estado y célula; no cambia al seleccionar un problema.</p>`:''}`;
  }else root.querySelector('[data-insight-summary]').innerHTML=`<p>Fecha local: ${dateLabel(data.today)} · ${e(data.timezone)}. ${data.missingBirthDate} fichas sin fecha válida en el conjunto consultado.</p>`;
  target.innerHTML=`<p role="status">${data.total} ${cell?'células':'personas'} · Página ${data.page} de ${data.pages}</p>${data.items.length?`<div class="insight-list">${data.items.map(p=>`<article class="insight-item"><div><h2>${cell?linkCell(p):personLink(p)}</h2><p>${e(cell?(p.status==='ACTIVE'?'Activa':'Cerrada'):(personStates[p.status]||p.status))}</p>${!cell?`<p>${cellsLabel(p.cells)}</p>`:''}</div><div>${birthday?`<dl class="insight-facts"><div><dt>Nacimiento</dt><dd>${dateLabel(p.birthDate)}</dd></div><div><dt>Edad actual</dt><dd>${p.birthday.age} años</dd></div><div><dt>Próximo cumpleaños</dt><dd>${dateLabel(p.birthday.date)}${p.birthday.adjusted?' · Ajustado 29/02':''}</dd></div><div><dt>Edad que cumple</dt><dd>${p.birthday.turning} años</dd></div><div><dt>Días restantes</dt><dd>${p.birthday.days===0?'Hoy':p.birthday.days}</dd></div>${p.phone?`<div><dt>Celular</dt><dd>${e(p.phone)}</dd></div>`:''}</dl>`:`${!cell?`<strong>${p.completeness.percent}% · ${p.level==='review'?'Requiere revisión':p.level==='complete'?'Completa':'Incompleta'}</strong><p class="subtle">${p.priority==='high'?'Prioridad: corregir datos inválidos u obligatorios':p.priority==='historical'?'Ficha inactiva: información recomendada pendiente':p.priority==='review'?'Posibles inconsistencias para revisar':'Información recomendada'}</p>`:''}<ul>${p.problems.map(problem=>`<li>${e(problem.label)}${problem.severity==='recommended'?' · recomendado':problem.severity==='error'?' · corregir':' · advertencia'}</li>`).join('')||'<li>Sin problemas detectados.</li>'}</ul>`}</div><div>${cell?`<a class="button secondary" href="#/oficina/celulas/${e(p.id)}">Revisar célula</a>`:`<a class="button secondary" href="#/oficina/personas/${e(p.id)}" data-person-id="${e(p.id)}">Revisar ficha</a>`}</div></article>`).join('')}</div>`:'<p class="empty-state">No hay registros para estos filtros.</p>'}<div class="people-pagination"><button class="button secondary" data-page="${data.page-1}" ${data.page<=1?'disabled':''}>Anterior</button><button class="button secondary" data-page="${data.page+1}" ${data.page>=data.pages?'disabled':''}>Siguiente</button></div>`;
  const cellSelect=root.querySelector('[name="cellId"]');if(cellSelect)cellSelect.innerHTML='<option value="">Todas</option>'+data.cells.map(c=>`<option value="${e(c.id)}" ${state.cellId===c.id?'selected':''}>${e(c.displayCode)}</option>`).join('')+(state.cellId&&!data.cells.some(c=>c.id===state.cellId)?`<option selected value="${e(state.cellId)}">Célula seleccionada</option>`:'');
  const problem=root.querySelector('[name="problem"]');if(problem){const selected=state.problem;for(const [value,label]of Object.entries(data.problemLabels))if(![...problem.options].some(o=>o.value===value))problem.add(new Option(label,value));problem.value=selected;}
 }
 async function refresh(){const seq=++serial;root.querySelector('[data-insight-results]').setAttribute('aria-busy','true');
  try{const keys=birthday?['q','status','cellId','sex','month','minAge','maxAge','view','page']:['q','status','cellId','completeness','problem','page'];const query=Object.fromEntries(keys.map(key=>[key,state[key]??'']));const result=await api((birthday?'birthdays':'quality/'+state.tab)+'?'+new URLSearchParams(query));if(!active||seq!==serial)return;data=result;render();}
  catch(err){if(active&&seq===serial)root.querySelector('[data-insight-results]').innerHTML=`<p role="alert">${e(err.message)}</p><button class="button secondary" data-retry>Reintentar</button>`;}
  finally{if(active&&seq===serial)root.querySelector('[data-insight-results]').removeAttribute('aria-busy');}
 }
 on('submit',ev=>{ev.preventDefault();Object.assign(state,Object.fromEntries(new FormData(ev.target)));state.page=1;refresh();});
 on('click',ev=>{const b=ev.target.closest('button');if(!b)return;
  if(b.dataset.page){state.page=Number(b.dataset.page);refresh();}
  if(b.dataset.problem){state.problem=b.dataset.problem;state.completeness='';state.page=1;root.querySelector('[name="problem"]').value=state.problem;root.querySelector('[name="completeness"]').value='';refresh();}
  if(b.dataset.tab){state.tab=b.dataset.tab;state.status=state.tab==='cells'?'ACTIVE':'ACTIVA';state.problem='all';state.completeness='';state.cellId='';state.q='';state.page=1;data=null;shell();refresh();}
  if(b.hasAttribute('data-reset')){Object.assign(state,{q:'',cellId:'',completeness:'',problem:'all',status:state.tab==='cells'?'ACTIVE':'ACTIVA',page:1,...(birthday?{view:'today',month:'',sex:'',minAge:'',maxAge:''}:{})});data=null;shell();refresh();}
  if(b.hasAttribute('data-retry'))refresh();
 });
 shell();refresh().then(()=>{if(active)window.scrollTo(0,state.scroll);});
}
