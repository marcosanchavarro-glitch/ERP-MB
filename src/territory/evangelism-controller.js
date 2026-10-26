import {escape as e} from '../components.js';
import {skeleton,holdLayout} from '../ui/skeleton.js';
import {territoryRequest} from './organization.js';
import {mountTerritory,unmountTerritory} from './controller.js';
import {mappable} from './geometry.js';
import {validateOuting,outingFields,outingStates,routeGeometry} from '../domain/evangelism.js';
import {evangelismBase,tabs,periodRange,comparisonRange,evangelismShell,activityCards,activityDetail,outingForm,participantItem,statisticsView,routeEditorView} from './evangelism-views.js';
let dispose=()=>{},dirty=false,busy=false;
export const evangelismRoute=path=>path.split('?')[0]===evangelismBase;
export function canLeaveEvangelism(){return !busy&&(!dirty||window.confirm('Hay cambios de Evangelismo sin guardar. ¿Querés descartarlos?'));}
export function unmountEvangelism(){dispose();dispose=()=>{};dirty=false;busy=false;}
window.addEventListener('beforeunload',event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}});
export function mountEvangelism(root){
 unmountEvangelism();const abort=new AbortController();let active=true,meta,selected=null,dialog=null,canvas=null,mapMounted=false,listData=null,statsData=null,routesData=[],editingRoute=false,drawing=false,points=[],undo=[],edgeMarkers=[],sequence=0,searchSequence=0,pendingFocus=null,detailSequence=0,routesSequence=0;const invalidPoints=new Set();
 const state={view:'summary',preset:'month',from:'',to:'',responsibleId:'',zone:'',sector:'',status:'',page:1,compare:true,canRead:false};
 const api=async(path,options={})=>{try{return await territoryRequest('/evangelism'+path,{...options,signal:abort.signal});}catch(error){if(active&&error.status===403&&(!options.method||options.method==='GET')){sequence++;detailSequence++;routesSequence++;dirty=false;editingRoute=false;selected=null;routesData=[];points=[];pendingFocus=null;invalidPoints.clear();dialog?.remove();dialog=null;clearEdges();unmountTerritory();canvas=null;mapMounted=false;root.innerHTML='<h1>Evangelismo</h1><p role="alert">Esta consulta ya no está disponible. Volvé a cargar la sección para actualizar las herramientas.</p><button type="button" class="button" data-ev-retry>Reintentar</button>';}throw error;}};
 const on=(kind,handler)=>root.addEventListener(kind,handler,{signal:abort.signal});
 const message=text=>{const host=root.querySelector('[data-ev-message]');if(host)host.textContent=text;};
 function clearDetail(){detailSequence++;selected=null;const host=root.querySelector('[data-ev-detail]');if(host){host.hidden=true;host.replaceChildren();}drawRoutes();}
 function clearEdges(){for(const m of edgeMarkers)m.remove();edgeMarkers=[];}
 dispose=()=>{active=false;abort.abort();dialog?.remove();dialog=null;clearEdges();unmountTerritory();};
 function query({page=true,comparison=false}={}){const q=new URLSearchParams();for(const k of ['from','to','responsibleId','zone','sector','status'])if(state[k])q.set(k,state[k]);if(page)q.set('page',state.page);if(comparison&&state.compare)for(const [key,value]of Object.entries(comparisonRange(state.from,state.to)))q.set(key,value);return q;}
 function discardRoute(){editingRoute=false;drawing=false;dirty=false;points=[];undo=[];root.querySelector('[data-ev-route-editor]')?.replaceChildren();clearEdges();drawRoutes();}
 function drawRoutes(){
  if(!canvas)return;const visible=root.querySelector('[data-ev-routes-visible]')?.checked!==false;
  const items=visible?routesData.filter(r=>!editingRoute||r.id!==selected?.id):[],features=items.map(r=>({type:'Feature',properties:{id:r.id,status:r.status},geometry:r.geometry}));
  if(editingRoute&&points.length>=2)features.push({type:'Feature',properties:{id:selected.id,status:selected.status},geometry:{type:'LineString',coordinates:points}});
  canvas.routes(features,{selected:selected?.id,onSelect:editingRoute?null:id=>openDetail(id)});
  clearEdges();if(editingRoute)for(const i of [...new Set([0,points.length-1])].filter(i=>i>=0&&points[i])){const p=points[i];edgeMarkers.push(canvas.marker({point:{longitude:p[0],latitude:p[1]},html:`<span class="ev-route-vertex">${i+1}</span>`,title:'Punto '+(i+1)+' del trazado de la actividad',draggable:true,onDrag:p=>{remember();points[i]=[p.longitude,p.latitude];changedRoute();}}));}
 }
 function remember(){undo.push(points.map(p=>[...p]));if(undo.length>40)undo.shift();}
 function changedRoute(render=true){dirty=true;const privacy=root.querySelector('[data-ev-route-privacy]');if(privacy)privacy.checked=false;if(render)renderPoints();else routeMessage();drawRoutes();}
 function routeMessage(extra=''){const host=root.querySelector('[data-ev-route-message]');if(!host)return;let length='';try{if(points.length>=2)length=' · '+(routeGeometry({type:'LineString',coordinates:points}).lengthMeters/1000).toLocaleString('es-AR',{maximumFractionDigits:2})+' km de longitud geométrica';}catch(error){length=' · '+error.message;}host.textContent=extra||points.length+' puntos'+length;}
 function renderPoints(){invalidPoints.clear();const list=root.querySelector('[data-ev-route-points]');if(!list)return;list.innerHTML=points.map(([lng,lat],i)=>`<li><label>Longitud ${i+1}<input type="number" step="any" min="-180" max="180" value="${lng}" data-ev-point="${i}" data-axis="0" aria-label="Longitud del punto ${i+1}"></label><label>Latitud ${i+1}<input type="number" step="any" min="-85.05112878" max="85.05112878" value="${lat}" data-ev-point="${i}" data-axis="1" aria-label="Latitud del punto ${i+1}"></label><button type="button" class="button secondary" data-ev-delete-point="${i}" aria-label="Quitar punto ${i+1}">Quitar</button></li>`).join('');routeMessage();}
 function addPoint(p){if(!editingRoute||!mappable(p))return;if(points.length>=500){routeMessage('Se alcanzó el máximo de 500 puntos.');return;}remember();points.push([p.longitude,p.latitude]);changedRoute();}
 function ensureMap(){
  if(mapMounted)return;mapMounted=true;
  mountTerritory(root.querySelector('[data-ev-map-host]'),{embedded:true,loadData:()=>meta.mapBase,onCanvas:map=>{clearEdges();canvas=map;if(map){drawRoutes();if(pendingFocus){map.fit(pendingFocus);pendingFocus=null;}}},onPoint:p=>{if(editingRoute&&drawing)addPoint(p);}});
 }
 async function loadRoutes(){
  if(!meta.capabilities.ver)return;const current=++routesSequence;const data=await api('/routes?'+query({page:false}));if(!active||current!==routesSequence)return;
  routesData=data.items;root.querySelector('[data-ev-route-count]').textContent=data.items.length+' recorridos manuales'+(data.more?' · se muestran los 50 más recientes del período. Acotá las fechas para consultar otros.':'.');
  if(selected?.route&&!routesData.some(r=>r.id===selected.id))routesData.push({id:selected.id,status:selected.status,geometry:selected.route.geometry});drawRoutes();
 }
 function visibleViews(){
  for(const button of root.querySelectorAll('[data-ev-tab]'))button.setAttribute('aria-pressed',String(button.dataset.evTab===state.view));
  root.querySelector('[data-ev-summary]').hidden=!['summary','statistics'].includes(state.view);root.querySelector('[data-ev-list]').hidden=!['outings','history','summary'].includes(state.view)||!meta.capabilities.ver;root.querySelector('[data-ev-timeline]').hidden=state.view!=='timeline';root.querySelector('[data-ev-map-section]').hidden=state.view!=='map';
  if(state.view==='map')ensureMap();
 }
 async function refresh(){
  if(!root.querySelector('.evangelism-page'))return;
  const token=++sequence,release=holdLayout(root);visibleViews();message('Cargando actividades…');
  try{
   if(['summary','statistics'].includes(state.view)){
    const host=root.querySelector('[data-ev-summary]');host.innerHTML=skeleton('list');statsData=await api('/statistics?'+query({page:false,comparison:true}));if(!active||token!==sequence)return;host.innerHTML=statisticsView(statsData,state,state.view==='statistics');
   }
   if(meta.capabilities.ver&&['outings','history','summary','timeline'].includes(state.view)){
    const host=root.querySelector(state.view==='timeline'?'[data-ev-timeline]':'[data-ev-list]');host.innerHTML=skeleton('list');const q=query();if(state.view==='history'&&q.get('to')>meta.today)q.set('to',meta.today);listData=state.view==='history'&&state.from>meta.today?{items:[],total:0,page:1,pages:1}:await api('/outings?'+q);if(!active||token!==sequence)return;state.page=listData.page;host.innerHTML=activityCards(listData,{timeline:state.view==='timeline'});
   }
   if(state.view==='map')await loadRoutes();if(active&&token===sequence)message('');
  }catch(error){if(active&&token===sequence&&error.name!=='AbortError'){message(error.message+' Podés reintentar con «Aplicar filtros».');for(const host of root.querySelectorAll('[data-ev-summary], [data-ev-list], [data-ev-timeline]'))if(host.querySelector('.skeleton'))host.innerHTML='<p role="alert">No se pudo completar esta consulta. Reintentá con «Aplicar filtros».</p>';}}
  finally{release();}
 }
 async function openDetail(id,{map=false,editRoute=false,events=1,focusRoute=true}={}){
  if(!root.querySelector('.evangelism-page')||!meta.capabilities.ver||busy)return;if(editingRoute&&dirty&&!canLeaveEvangelism())return;if(editingRoute)discardRoute();
  const current=++detailSequence,release=holdLayout(root),host=root.querySelector('[data-ev-detail]');host.hidden=false;host.innerHTML=skeleton('profile');
  try{const data=await api('/outings/'+id+'?page='+events);if(!active||current!==detailSequence||!host.isConnected)return;selected=data;host.innerHTML=activityDetail(data);
   if(map||editRoute){if(map&&focusRoute&&data.route)pendingFocus=data.route.geometry.coordinates.map(([longitude,latitude])=>({latitude,longitude}));state.view='map';visibleViews();await loadRoutes();if(editRoute){editingRoute=true;drawing=true;points=(data.route?.geometry.coordinates||[]).map(p=>[...p]);undo=[];dirty=false;root.querySelector('[data-ev-route-editor]').innerHTML=routeEditorView();renderPoints();drawRoutes();}else if(pendingFocus&&canvas){canvas.fit(pendingFocus);pendingFocus=null;}}
   else drawRoutes();
  }catch(error){if(active&&current===detailSequence&&host.isConnected){host.innerHTML=`<p role="alert">${e(error.message)}</p>`;}}
  finally{release();}
 }
 async function openForm(a=null){
  if(!canLeaveEvangelism())return;if(editingRoute)discardRoute();dirty=false;dialog?.remove();dialog=document.createElement('dialog');dialog.className='ev-outing-dialog';dialog.setAttribute('aria-label',a?'Editar salida evangelística':'Nueva salida evangelística');dialog.innerHTML=outingForm(meta,a);document.body.append(dialog);dialog.showModal();const target=dialog,form=target.querySelector('form'),participants=new Map((a?.participants||[]).map(p=>[p.id,p]));
  const close=()=>{if(!canLeaveEvangelism())return;dirty=false;target.close();};
  target.addEventListener('close',()=>{target.remove();if(dialog===target)dialog=null;},{once:true});target.addEventListener('cancel',event=>{if(!canLeaveEvangelism())event.preventDefault();else dirty=false;});
  target.querySelector('[data-ev-close-form]').onclick=close;form.addEventListener('input',()=>{dirty=true;});
  form.addEventListener('input',async event=>{
   if(!event.target.matches('[data-ev-person-search]'))return;const current=++searchSequence,q=event.target.value.trim(),host=form.querySelector('[data-ev-person-results]');host.replaceChildren();if(q.length<2)return;
   try{const data=await api('/people?'+new URLSearchParams({q}));if(!active||!target.open||current!==searchSequence)return;host.innerHTML=data.items.map(p=>`<button type="button" class="button secondary" data-ev-add-person="${e(p.id)}">${e(p.names+' '+p.lastNames)}</button>`).join('')||'<p>No se encontraron fichas para esta consulta.</p>';host.people=data.items;}catch(error){if(target.open)host.textContent=error.message;}
  });
  form.addEventListener('click',event=>{
   const add=event.target.closest('[data-ev-add-person]'),remove=event.target.closest('[data-ev-remove-person]');if(add){const p=form.querySelector('[data-ev-person-results]').people?.find(p=>p.id===add.dataset.evAddPerson);if(p){participants.set(p.id,p);dirty=true;}}if(remove){participants.delete(remove.dataset.evRemovePerson);dirty=true;}if(add||remove)form.querySelector('[data-ev-participants]').innerHTML=[...participants.values()].map(participantItem).join('');
  });
  form.onsubmit=async event=>{
   event.preventDefault();if(busy)return;const values=Object.fromEntries(outingFields.map(k=>[k,form.elements[k].value]));values.participantCount=values.participantCount===''?null:Number(values.participantCount);const {errors}=validateOuting(values),host=form.querySelector('[data-ev-form-message]');if(Object.keys(errors).length){host.textContent=Object.values(errors).join(' ');return;}
   busy=true;const button=form.querySelector('[type=submit]');button.disabled=true;host.textContent='Guardando…';
   try{const body={outing:values,...(a?{version:a.version}:{})};if(meta.canLinkParticipants)body.participantIds=[...participants.keys()];const saved=await api('/outings'+(a?'/'+a.id:''),{method:a?'PUT':'POST',body:JSON.stringify(body)});if(!active)return;dirty=false;busy=false;target.close();await refresh();await openDetail(saved.id);message('Salida guardada.');}
   catch(error){if(target.open)host.textContent=error.message;}finally{busy=false;if(button.isConnected)button.disabled=false;}
  };
 }
 on('submit',event=>{if(!event.target.matches('[data-ev-filters]'))return;event.preventDefault();if(editingRoute&&dirty&&!canLeaveEvangelism())return;if(editingRoute)discardRoute();const form=event.target;for(const k of ['preset','from','to','responsibleId','zone','sector','status'])state[k]=form.elements[k].value;state.compare=form.elements.compare.checked;state.page=1;clearDetail();refresh();});
 on('change',event=>{
  if(event.target.matches('[name=preset]')){const range=periodRange(event.target.value,meta.today),form=event.target.form;if(event.target.value!=='custom'){form.elements.from.value=range.from;form.elements.to.value=range.to;}}
  if(event.target.matches('[data-ev-routes-visible]'))drawRoutes();
  if(event.target.matches('[data-ev-point]')){const i=Number(event.target.dataset.evPoint),axis=Number(event.target.dataset.axis),value=Number(event.target.value),p=[...points[i]];p[axis]=value;if(event.target.value===''||!mappable({longitude:p[0],latitude:p[1]})){invalidPoints.add(i+':'+axis);routeMessage('Revisá las coordenadas de este punto. La vista previa conserva el último valor válido.');return;}invalidPoints.delete(i+':'+axis);remember();points[i]=p;changedRoute(false);}
 });
 on('click',async event=>{
  const chart=event.target.closest('.halo-chart-key');if(chart){event.preventDefault();if(!meta.capabilities.ver)return;const q=new URL(chart.href).hash.split('?')[1],params=new URLSearchParams(q||'');if(params.has('status')){state.status=params.get('status');root.querySelector('[data-ev-filters]').elements.status.value=state.status;}state.view='outings';state.page=1;clearDetail();refresh();return;}
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-ev-create'))openForm();
  if(button.hasAttribute('data-ev-edit')&&selected)openForm(selected);
  if(button.hasAttribute('data-ev-open'))openDetail(button.dataset.evOpen);
  if(button.hasAttribute('data-ev-map'))openDetail(button.dataset.evMap,{map:true});
  if(button.hasAttribute('data-ev-edit-route')&&selected)openDetail(selected.id,{editRoute:true});
  if(button.hasAttribute('data-ev-events')&&selected)openDetail(selected.id,{events:Number(button.dataset.evEvents)});
  if(button.hasAttribute('data-ev-close-detail')){if(!canLeaveEvangelism())return;if(editingRoute)discardRoute();clearDetail();}
  if(button.hasAttribute('data-ev-tab')){if(!canLeaveEvangelism())return;if(editingRoute)discardRoute();state.view=button.dataset.evTab;state.page=1;refresh();}
  if(button.hasAttribute('data-ev-page')){state.page=Number(button.dataset.evPage);refresh();}
  if(button.hasAttribute('data-ev-reset')){if(!canLeaveEvangelism())return;if(editingRoute)discardRoute();const form=root.querySelector('[data-ev-filters]');form.reset();Object.assign(state,periodRange('month',meta.today),{preset:'month',responsibleId:'',zone:'',sector:'',status:'',page:1,compare:true});form.elements.from.value=state.from;form.elements.to.value=state.to;clearDetail();refresh();}
  if(button.hasAttribute('data-ev-state')&&selected){const status=button.dataset.evState,reason=status==='CANCELLED'?window.prompt('Motivo de cancelación:'):null;if(status==='CANCELLED'&&reason===null)return;if(!window.confirm('¿Confirmás '+(status==='IN_PROGRESS'?'iniciar':status==='COMPLETED'?'finalizar como realizada':'cancelar')+' esta actividad?'))return;busy=true;button.disabled=true;try{await api('/outings/'+selected.id+'/state',{method:'POST',body:JSON.stringify({status,version:selected.version,reason,confirmed:true})});busy=false;await openDetail(selected.id);await refresh();message('Estado actualizado.');}catch(error){message(error.message);}finally{busy=false;if(button.isConnected)button.disabled=false;}}
  if(button.hasAttribute('data-ev-draw')){drawing=!drawing;button.setAttribute('aria-pressed',String(drawing));button.textContent=drawing?'Dibujo activo':'Dibujo pausado';}
  if(button.hasAttribute('data-ev-add-point')){const host=root.querySelector('[data-ev-route-editor]'),lat=host.querySelector('[name=pointLatitude]').value,lng=host.querySelector('[name=pointLongitude]').value;if(lat===''||lng===''){routeMessage('Completá ambas coordenadas.');return;}const p={latitude:Number(lat),longitude:Number(lng)};if(!mappable(p)){routeMessage('Coordenadas inválidas.');return;}addPoint(p);}
  if(button.hasAttribute('data-ev-delete-point')){remember();points.splice(Number(button.dataset.evDeletePoint),1);changedRoute();}
  if(button.hasAttribute('data-ev-undo')&&undo.length){points=undo.pop();changedRoute();}
  if(button.hasAttribute('data-ev-generalize')){remember();points=points.map(p=>p.map(n=>Number(n.toFixed(3)))).filter((p,i,a)=>!i||p[0]!==a[i-1][0]||p[1]!==a[i-1][1]);changedRoute();}
  if(button.hasAttribute('data-ev-discard-route')&&canLeaveEvangelism())discardRoute();
  if(button.hasAttribute('data-ev-save-route')&&selected&&!busy){try{if(invalidPoints.size){routeMessage('Corregí los valores inválidos de los puntos antes de guardar.');return;}const geometry=routeGeometry({type:'LineString',coordinates:points}).geometry;if(!root.querySelector('[data-ev-route-privacy]').checked){routeMessage('Revisá el trazado y confirmá la condición de privacidad antes de guardar.');return;}busy=true;button.disabled=true;routeMessage('Guardando recorrido…');await api('/outings/'+selected.id+'/route',{method:'PUT',body:JSON.stringify({geometry,version:selected.version,privacyConfirmed:true})});busy=false;const id=selected.id;discardRoute();await openDetail(id,{map:true,focusRoute:false});message('Recorrido guardado.');}catch(error){routeMessage(error.message);}finally{busy=false;if(button.isConnected)button.disabled=false;}}
 });
 async function load(){root.innerHTML=skeleton('list');try{meta=await api('/meta');if(!active)return;state.canRead=meta.capabilities.ver;Object.assign(state,periodRange('month',meta.today));state.view=meta.capabilities.estadisticas?'summary':'outings';const initial=new URLSearchParams(location.hash.split('?')[1]||'');if(Object.hasOwn(tabs,initial.get('view'))){const requested=initial.get('view');if(['summary','statistics'].includes(requested)?meta.capabilities.estadisticas:meta.capabilities.ver)state.view=requested;}if(Object.hasOwn(outingStates,initial.get('status')))state.status=initial.get('status');root.innerHTML=evangelismShell(meta,state);root.querySelector('[data-ev-filters]').elements.status.value=state.status;await refresh();}catch(error){if(active)root.innerHTML=`<h1>Evangelismo</h1><p role="alert">${e(error.message)}</p><button type="button" class="button" data-ev-retry>Reintentar</button>`;}}
 on('click',event=>{if(event.target.closest('[data-ev-retry]'))load();});
 load();
}
