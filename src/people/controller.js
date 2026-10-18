import {personContextReturn} from './context.js';
import {loadAccountAction} from '../identity-admin/api.js';
import {loadPersonFollowup} from '../followup/controller.js';
import {openQuickPerson} from './quick.js';
import {loadPersonAttendance} from '../meetings/panels.js';
import {loadPersonCells} from '../cells/person-panel.js';
import {escape as e,pageTitle} from '../components.js';
import {icon} from '../icons.js';
import {request} from './api.js';
import {basePath,loading,errorView,listRows,profileView,profileBody,historyView,formView,formData,personLink} from './views.js';
import {blankPerson,validatePerson,personStates,sexes,fields,fullName} from '../domain/person.js';
const listState={q:'',status:'',sex:'',locality:'',completeness:'',sort:'name',direction:'asc',page:1,pageSize:20,scroll:0};
let dirty=false,saving=false,dispose=()=>{};
export function canLeavePeople() {return !saving && (!dirty || window.confirm('Tenés cambios sin guardar. ¿Querés descartarlos y salir?'));}
window.addEventListener('beforeunload',event=>{if(dirty||saving){event.preventDefault();event.returnValue='';}});
export function unmountPeople() {dispose();dispose=()=>{};dirty=false;saving=false;}
export function peopleRoute(path) {
 if(path===basePath)return {kind:'list'};
 if(path===`${basePath}/nueva`)return {kind:'create'};
 const match=path.match(/^\/oficina\/personas\/([0-9a-f-]{36})(\/editar)?$/i);
 return match?{kind:match[2]?'edit':'profile',id:match[1]}:null;
}
const demoNotice='<div class="demo-notice">Entorno de demostración · Usá exclusivamente datos ficticios.</div>';
export function mountPeople(root,route) {
 unmountPeople();
 let active=true,sequence=0,searchTimer,person,tab='summary';
 const listeners=new AbortController();
 dispose=()=>{active=false;sequence++;clearTimeout(searchTimer);listeners.abort();if(route.kind==='list')listState.scroll=window.scrollY;};
 const on=(event,handler)=>root.addEventListener(event,handler,{signal:listeners.signal});
 function renderError(error,retry){if(!active)return;root.innerHTML=errorView(error.message);root.querySelector('button').onclick=retry;}
 async function refreshRows() {
  const current=++sequence;
  const target=root.querySelector('#people-results');if(!target)return;
  target.setAttribute('aria-busy','true');
  try {const data=await request(`?${new URLSearchParams(Object.entries(listState).filter(([key])=>key!=='scroll'))}`);if(!active||current!==sequence||!target.isConnected)return;listState.page=data.page;target.innerHTML=listRows(data);root.querySelector('#results-announcement').textContent=`${data.total} personas encontradas. Página ${data.page} de ${data.pages}.`;}
  catch(error){if(active&&current===sequence)target.innerHTML=errorView(error.message);}
  finally{if(active&&current===sequence)target.setAttribute('aria-busy','false');}
 }
 async function loadList() {
  root.innerHTML=loading;
  try {
   const meta=await request('/meta');if(!active)return;
   const select=(key,label,options)=>`<label class="filter-control">${label}<select name="${key}" aria-label="${label}"><option value="">Todos</option>${Object.entries(options).map(([value,text])=>`<option value="${e(value)}" ${listState[key]===value?'selected':''}>${e(text)}</option>`).join('')}</select></label>`;
   root.innerHTML=`${demoNotice}<div class="people-page-heading">${pageTitle('OFICINA · BASE CENTRAL','Personas / Matriz','Una persona, una ficha. Toda la información en un mismo lugar.')} ${meta.capabilities.create?`<div class="people-heading-actions"><button class="button" data-people-action="quick-create">Alta rápida</button><a class="button secondary" href="#${basePath}/nueva">${icon('people')} Nueva persona</a></div>`:''}</div><section class="matrix" aria-label="Listado de personas"><div class="matrix-toolbar"><label class="people-search">${icon('search')}<span class="sr-only">Buscar personas</span><input name="q" type="search" maxlength="150" placeholder="Buscar por nombre, documento o celular" value="${e(listState.q)}"></label><label class="sort-control">Ordenar<select name="sort"><option value="name" ${listState.sort==='name'?'selected':''}>Apellido y nombre</option><option value="updatedAt" ${listState.sort==='updatedAt'?'selected':''}>Última modificación</option><option value="joinedDate" ${listState.sort==='joinedDate'?'selected':''}>Incorporación</option></select></label><button class="button secondary" data-people-action="direction" aria-label="Cambiar dirección del orden">${listState.direction==='asc'?'Ascendente':'Descendente'}</button></div><div class="matrix-filters">${select('status','Estado',personStates)}${select('sex','Sexo',sexes)}${select('locality','Localidad',Object.fromEntries(meta.localities.map(value=>[value,value])))}${select('completeness','Ficha',{complete:'Completa',incomplete:'Por completar'})}<button class="clear-filters" data-people-action="clear">Limpiar filtros</button></div><span id="results-announcement" class="sr-only" role="status"></span><div id="people-results">${loading}</div></section><p class="matrix-help">Seleccioná un nombre para consultar su ficha sin perder tu lugar en la Matriz.</p>`;
   await refreshRows();if(active)window.scrollTo(0,listState.scroll);
  }catch(error){renderError(error,loadList);}
 }
 async function loadHistory(page=1) {
  const target=root.querySelector('[data-history-host]');if(!target)return;target.innerHTML=loading;
  try {const data=await request(`/${route.id}/history?page=${page}`);if(active&&target.isConnected)target.innerHTML=historyView(data);}catch(error){if(active&&target.isConnected)target.innerHTML=errorView(error.message);}
 }
 async function loadProfile() {
  root.innerHTML=loading;
  try {person=await request(`/${route.id}`);if(!active)return;root.innerHTML=`${demoNotice}<a class="back-to-matrix" href="#${personContextReturn()||basePath}">← ${personContextReturn()?'Volver a la consulta':'Volver a la Matriz'}</a>${profileView(person,{tab})}`;loadAccountAction(root,person);if(tab==='history')loadHistory();if(tab==='cell')loadPersonCells(root,person.id);if(tab==='attendance')loadPersonAttendance(root,person.id);if(tab==='followup')loadPersonFollowup(root,person.id);}
  catch(error){renderError(error,loadProfile);}
 }
 async function loadForm() {
  root.innerHTML=loading;
  try {
   if(route.kind==='edit') {person=await request(`/${route.id}`);if(!person.capabilities.edit)throw new Error('No tenés permiso para editar esta persona.');}
   else {const meta=await request('/meta');if(!meta.capabilities.create)throw new Error('No tenés permiso para registrar personas.');person=blankPerson();}
   if(!active)return;
   dirty=false;
   root.innerHTML=`${demoNotice}<a class="back-to-matrix" href="#${route.id?`${basePath}/${route.id}`:basePath}">← ${route.id?'Volver a la ficha':'Volver a la Matriz'}</a>${pageTitle('OFICINA · PERSONAS',route.kind==='edit'?'Editar persona':'Nueva persona',route.kind==='edit'?fullName(person):'Completá los datos disponibles. Podés ampliar la ficha más adelante.')}${formView(person)}`;
  }catch(error){renderError(error,loadForm);}
 }
 function showFormErrors(error) {
  const summary=root.querySelector('#form-message');
  summary.className='form-message';summary.setAttribute('role','alert');
  summary.innerHTML=`<strong>${e(error.message)}</strong>${error.matches?`<ul>${error.matches.map(match=>`<li>${personLink(match)}</li>`).join('')}</ul><label class="duplicate-confirm"><input type="checkbox" id="ack-duplicates"> Revisé las coincidencias y se trata de otra persona.</label>`:''}${error.code==='VERSION_CONFLICT'?`<p>${personLink(person)} · <button type="button" class="clear-filters" data-people-action="reload-form">Descartar cambios y cargar la versión actual</button></p>`:''}`;
  for(const field of fields) {
   const input=root.querySelector(`[name="${field.key}"]`),message=error.fields?.[field.key] || '';
   root.querySelector(`#error-${field.key}`).textContent=message;
   input.setAttribute('aria-invalid',String(Boolean(message)));input.setAttribute('aria-describedby',`error-${field.key}`);
  }
  summary.focus();
 }
 on('input',event=>{
  if(event.target.closest('#person-form') && event.target.id!=='ack-duplicates'){
   dirty=true;const ack=root.querySelector('#ack-duplicates');if(ack)ack.checked=false;
   const fieldError=root.querySelector(`#error-${event.target.name}`);
   if(fieldError){fieldError.textContent='';event.target.setAttribute('aria-invalid','false');}
  }
  if(event.target.name==='q'&&route.kind==='list'){listState.q=event.target.value;listState.page=1;clearTimeout(searchTimer);searchTimer=setTimeout(refreshRows,220);}
 });
 on('change',event=>{
  if(route.kind==='list'&&event.target.matches('select')){listState[event.target.name]=event.target.value;listState.page=1;refreshRows();}
 });
 on('click',event=>{
  const action=event.target.closest('[data-people-action]')?.dataset.peopleAction;
  if(action==='quick-create')openQuickPerson({onCreated:()=>{listState.q='';listState.page=1;return loadList();}}).catch(error=>window.alert(error.message));
  if(action==='clear'){Object.assign(listState,{q:'',status:'',sex:'',locality:'',completeness:'',page:1,scroll:0});loadList();}
  if(action==='direction'){listState.direction=listState.direction==='asc'?'desc':'asc';event.target.closest('button').textContent=listState.direction==='asc'?'Ascendente':'Descendente';refreshRows();}
  if(action==='retry'){if(route.kind==='list')refreshRows();else if(tab==='history')loadHistory();}
  if(action==='cancel-form'&&!saving)location.hash=route.id?`${basePath}/${route.id}`:basePath;
  if(action==='reload-form'&&canLeavePeople())loadForm();
  const page=event.target.closest('[data-page]');if(page){listState.page=Number(page.dataset.page);refreshRows();}
  const historyPage=event.target.closest('[data-history-page]');if(historyPage)loadHistory(historyPage.dataset.historyPage);
  const tabButton=event.target.closest('[data-profile-tab]');if(tabButton){tab=tabButton.dataset.profileTab;root.querySelectorAll('[data-profile-tab]').forEach(el=>el.setAttribute('aria-pressed',String(el===tabButton)));root.querySelector('[data-profile-body]').innerHTML=profileBody(person,tab);if(tab==='history')loadHistory();if(tab==='cell')loadPersonCells(root,person.id);if(tab==='attendance')loadPersonAttendance(root,person.id);if(tab==='followup')loadPersonFollowup(root,person.id);}
 });
 on('submit',async event=>{
  if(event.target.id!=='person-form')return;event.preventDefault();if(saving)return;
  const form=event.target,input=formData(form),validation=validatePerson(input);
  if(Object.keys(validation.errors).length){showFormErrors({message:'Revisá los campos indicados.',fields:validation.errors});return;}
  const acknowledgeDuplicates=Boolean(root.querySelector('#ack-duplicates')?.checked);
  saving=true;const submit=root.querySelector('#save-person');submit.disabled=true;submit.textContent='Guardando…';
  // Freeze fields while saving so a late edit cannot be silently discarded.
  const controls=[...form.querySelectorAll('input,select,textarea,button')];controls.forEach(control=>control.disabled=true);
  try {
   const saved=await request(route.id?`/${route.id}`:'',{method:route.id?'PUT':'POST',body:JSON.stringify({person:input,version:person.version,acknowledgeDuplicates})});
   dirty=false;saving=false;location.hash=`${basePath}/${saved.id}`;
  }catch(error){if(active)showFormErrors(error);}
  finally {saving=false;if(active){controls.forEach(control=>control.disabled=false);submit.textContent='Guardar persona';}}
 });
 if(route.kind==='list')loadList();else if(route.kind==='profile')loadProfile();else loadForm();
}
