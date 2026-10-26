import {analysisView} from './analysis-views.js';
import {territoryRequest,fillTerritoryFilters,mountOrganization,assignmentView} from './organization.js';
import {identity} from '../branding.js';
import {locationMarker,markerAssetError} from './markers.js';
import {escape as e} from '../components.js';
import {skeleton,holdLayout} from '../ui/skeleton.js';
import {mapShell,detail,ageLabel,siteDetail} from './views.js';
import {mountSiteEditor} from './site-editor.js';
import {mappable} from './geometry.js';
import {createMapCanvas} from './map-canvas.js';
let dispose=()=>{};
export const territoryRoute=path=>['/territorio/mapa','/territorio/analisis'].includes(path);
export function unmountTerritory(){dispose();dispose=()=>{};}
export function mountTerritory(root,options={}){
 unmountTerritory();root.innerHTML=mapShell();
 if(options.embedded){root.querySelector('.territory-heading').hidden=true;root.querySelector('.territory-filters').hidden=true;root.querySelector('[data-territory-visualization]').closest('label').hidden=true;root.querySelector('[data-territory-map]').setAttribute('aria-label','Mapa territorial de actividades. El listado y la edición por coordenadas están disponibles fuera del mapa.');}
 const analysis=location.hash.slice(1)==='/territorio/analisis';let metadata={items:[],geography:[],canManage:false},organizationAbort=null;
 if(analysis){root.querySelector('h1').textContent='Análisis territorial';root.querySelector('.territory-heading p').textContent='Distribución de células registradas y organización del ámbito territorial.';root.querySelector('[name="status"]').closest('label').hidden=true;}

 let active=true,data=null,selected=null,map=null,request=null,sequence=0,tileTimer,resetTimer,resetRelease=()=>{},circles=[],markerEntries=new Map(),initializing=null,canvasAbort=null,mapGeneration=0,mapError=false,siteMarker=null,disposeSite=null;
 const abort=new AbortController(),host=root.querySelector('[data-territory-map]'),status=root.querySelector('[data-territory-status]'),mapState=root.querySelector('[data-territory-map-state]'),panel=root.querySelector('[data-territory-detail]'),list=root.querySelector('[data-territory-list]'),error=root.querySelector('[data-territory-error]'),coverage=root.querySelector('[data-territory-coverage]');
 const on=(type,fn)=>root.addEventListener(type,fn,{signal:abort.signal});
 const points=()=>data?.items.filter(c=>mappable(c)&&c.coordinateStatus==='VERIFIED')||[];
 const site=()=>data?.central?.coordinateStatus==='VERIFIED'&&mappable(data.central)?data.central:null;
 const typeControl=type=>root.querySelector(`[data-territory-type="${type}"]`),typeEnabled=type=>typeControl(type).checked;
 const visiblePoints=()=>typeEnabled('CELL')?points():[];
 let recommendedCell=null;
 try{const id=sessionStorage.getItem('halo-territory-cell');sessionStorage.removeItem('halo-territory-cell');if(/^[0-9a-f-]{36}$/i.test(id))recommendedCell=id;}catch{}
 root.addEventListener('error',markerAssetError,{capture:true,signal:abort.signal});
 function typeTools(){
  const available={CHURCH:Boolean(site()),CELL:points().length>0};root.querySelector('[data-territory-types]').hidden=!Object.values(available).some(Boolean);
  for(const [type,exists]of Object.entries(available)){root.querySelector(`[data-territory-type-option="${type}"]`).hidden=!exists;root.querySelector(`[data-territory-legend-type="${type}"]`).hidden=!exists||!typeEnabled(type);}
 }

 function clearMap(){options.onCanvas?.(null);canvasAbort?.abort();canvasAbort=null;mapGeneration++;initializing=null;clearTimeout(tileTimer);circles.forEach(remove=>remove());circles=[];for(const marker of markerEntries.values())marker.remove();markerEntries.clear();siteMarker?.remove();siteMarker=null;map?.destroy();map=null;}
 const resize=new ResizeObserver(()=>{if(host.clientWidth&&host.clientHeight)map?.resize();});resize.observe(host);
 dispose=()=>{active=false;sequence++;request?.abort();abort.abort();organizationAbort?.abort();disposeSite?.();clearTimeout(resetTimer);resetRelease();resize.disconnect();clearMap();};
 function mapFailure(){if(!active||mapError)return;mapError=true;clearTimeout(tileTimer);if(map?.kind==='maplibre'&&data?.provider.geoapify?.configured&&!map.fallbackReason){startMap(true);return;}mapState.hidden=false;mapState.innerHTML='<p>No pudimos cargar el mapa base. Podés consultar las células en el listado.</p><button class="button secondary" data-territory-map-retry>Reintentar mapa</button>';}
 function drawCoverage(){
  circles.forEach(remove=>remove());circles=[];if(!map||!coverage.checked)return;
  for(const c of visiblePoints())if(Number.isFinite(c.coverageRadiusMeters)&&c.coverageRadiusMeters>0)circles.push(map.circle(c,c.id===selected));
 }
 function select(id,focus=true){
  const c=data?.items.find(c=>c.id===id);if(!c)return;typeControl('CELL').checked=true;typeTools();selected=id;panel.innerHTML=detail(c)+(data.canManageTerritory&&metadata.canManage&&c.status==='ACTIVE'?assignmentView(c,metadata):'');panel.hidden=false;
  list.querySelectorAll('[data-territory-select]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.territorySelect===id)));
  // Selecting a detail keeps the user's viewport and zoom.
  drawMarkers();drawCoverage();if(focus)panel.focus({preventScroll:true});
 }
 function drawMarkers(){
  if(!map)return;const visible=new Set(),groups=new Map(),zoom=map.view().zoom;
  for(const c of visiblePoints().filter(c=>root.querySelector('[data-territory-visualization]').value!=='density'||c.id===selected)){
   if(!map.contains(c))continue;const p=map.project(c),key=zoom>=17||c.id===selected?c.id:`${Math.floor(p.x/58)}:${Math.floor(p.y/58)}`;
   if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c);
  }
  for(const group of groups.values()){
   const c=group[0],cluster=group.length>1,key=cluster?'cluster:'+group.map(c=>c.id).join(','):c.id;visible.add(key);
   const title=cluster?`${group.length} células. Acercar mapa.`:`Seleccionar ${c.displayCode}`;
   if(!markerEntries.has(key))markerEntries.set(key,map.marker({...locationMarker({type:'CELL',id:c.id,coordinates:c,selected:c.id===selected,context:{title,count:cluster?group.length:0}}),onSelect:()=>cluster?map.setView(c,Math.min(17,map.view().zoom+2)):select(c.id)}));
   markerEntries.get(key).update(c,c.id===selected,c.id===selected?1000:0,title);
  }
  for(const [key,marker]of markerEntries)if(!visible.has(key)){marker.remove();markerEntries.delete(key);}
  drawSite();drawDensity();
 }
 function drawDensity(){const mode=root.querySelector('[data-territory-visualization]').value,enabled=mode!=='markers';root.querySelector('[data-territory-density-note]').hidden=!enabled;map?.density(visiblePoints().filter(c=>c.status==='ACTIVE'),enabled);}
 function renderAnalysis(query){
  const summary=root.querySelector('[data-territory-analysis]'),breakdown=root.querySelector('[data-territory-breakdown]');
  summary.innerHTML=analysisView(data?.analysis,query);breakdown.replaceChildren();const details=summary.querySelector('[data-analysis-breakdown]');if(details)breakdown.append(details);
 }
 async function loadOrganization(){
  try{const value=await territoryRequest('/units',{signal:abort.signal});if(!active)return;metadata=value;fillTerritoryFilters(root,metadata);
   if(analysis){const target=root.querySelector('[data-territory-organization]'),open=target.querySelector('details')?.open;organizationAbort?.abort();organizationAbort=new AbortController();mountOrganization(target,metadata,{signal:organizationAbort.signal,onSaved:async()=>{const release=holdLayout(root);try{await loadOrganization();await fetchCells();}finally{release();}}});if(open&&target.querySelector('details'))target.querySelector('details').open=true;}
  }catch(err){if(active&&err.name!=='AbortError')root.querySelector('[data-territory-organization]').innerHTML=`<p role="alert">No pudimos cargar la organización territorial. ${e(err.message)}</p><button class="button secondary" type="button" data-organization-retry>Reintentar organización</button>`;}
 }
 function drawSite(){
  if(!map)return;const s=site();if(!s||!typeEnabled('CHURCH')){siteMarker?.remove();siteMarker=null;return;}
  const title=s.institution+' — '+s.name;
  if(!siteMarker)siteMarker=map.marker({...locationMarker({type:'CHURCH',id:s.id,coordinates:s,selected:selected==='central',context:{title},visualResource:identity.logo}),onSelect:()=>{selected='central';panel.innerHTML=siteDetail(data.central);panel.hidden=false;list.querySelectorAll('[data-territory-select]').forEach(b=>b.setAttribute('aria-pressed','false'));drawMarkers();drawCoverage();panel.focus({preventScroll:true});}});
  siteMarker.element.classList.add('territory-site-marker');siteMarker.update(s,selected==='central',1200,title);
 }
 function recenter(){if(!map)return;const central=site();if(central){typeControl('CHURCH').checked=true;typeTools();drawSite();map.setView(central,16);}else map.setView(data.reference,data.reference.zoom);}
 async function startMap(forceFallback=false){
  if(map&&!mapError&&!forceFallback){drawMarkers();drawCoverage();return;}
  if(initializing)return initializing;
  const previous=map?.view();clearMap();mapError=false;const generation=++mapGeneration;canvasAbort=new AbortController();
  mapState.hidden=false;mapState.textContent='Cargando mapa…';
  const task=(async()=>{try{
   const provider=forceFallback?{...data.provider,geoapify:{configured:false}}:data.provider;let ready=false,pendingFailure=false;
   const canvas=await createMapCanvas(host,{provider,center:previous||data.reference,signal:canvasAbort.signal,onClick:point=>options.onPoint?.(point),onMove:()=>{drawMarkers();},onReady:()=>{ready=true;if(active&&!mapError){clearTimeout(tileTimer);mapState.hidden=true;}},onError:()=>{if(map)mapFailure();else pendingFailure=true;}});
   if(!active||generation!==mapGeneration||!data){canvas.destroy();return;}map=canvas;
   const providerStatus=root.querySelector('[data-territory-provider]');providerStatus.hidden=!map.fallbackReason;providerStatus.textContent=forceFallback?'Cartografía de respaldo · Geoapify no está disponible.':map.fallbackReason==='WEBGL_UNAVAILABLE'?'Mapa de respaldo · el motor vectorial no está disponible en este dispositivo.':map.fallbackReason?'Cartografía de respaldo · Geoapify pendiente de configuración.':'';

   if(!ready)tileTimer=setTimeout(mapFailure,15000);if(pendingFailure)queueMicrotask(mapFailure);if(!previous)recenter();drawMarkers();drawCoverage();options.onCanvas?.(map);
  }catch(error){if(error.name!=='AbortError')mapFailure();}finally{if(initializing===task)initializing=null;}})();initializing=task;return task;
 }
 function textList(){
  typeTools();
  const home=root.querySelector('[data-territory-recenter]');home.disabled=!site();home.title=site()?'Restaurar la vista inicial de la sede':'La ubicación de la sede todavía no está confirmada';const notice=root.querySelector('[data-territory-notice]');notice.textContent=[!points().length?'Todavía no hay células ubicadas en el mapa. Podés comenzar registrando sus lugares de reunión.':'',!points().length&&!site()?data.reference.label+' · sin ubicaciones verificadas.':'',data.canManageSite&&!site()?'Sede central pendiente de confirmar.':''].filter(Boolean).join(' ');if(data.canManageCells&&!points().length)notice.insertAdjacentHTML('beforeend',' <a href="#/oficina/celulas">Gestionar células</a>');
  const settings=root.querySelector('[data-territory-site]');settings.hidden=!data.canManageSite;if(data.canManageSite&&!disposeSite)disposeSite=mountSiteEditor(settings,{onSaved:s=>{data.central={...s,locationAccuracy:s.verification?.accuracy};drawSite();textList();}});
  const missing=data.missingLocation,limited=data.items.filter(c=>!mappable(c)&&c.latitude!=null).length;
  status.textContent=`${data.total} células · ${missing} sin coordenadas válidas${limited?' · '+limited+' fuera de la proyección del mapa base':''}. Página ${data.page} de ${data.pages}.`;
  list.innerHTML=data.items.length?`<ul>${data.items.map(c=>`<li><button class="territory-cell" data-territory-select="${e(c.id)}" aria-pressed="${c.id===selected}"><strong>${e(c.displayCode)}</strong><span>${e(c.locality||'Sin localidad')} · ${e(ageLabel(c))}</span><small>${!mappable(c)?'Ubicación no representable en el mapa':c.coordinateStatus==='VERIFIED'?'Verificada manualmente':'Pendiente de verificar'}</small></button></li>`).join('')}</ul><div class="people-pagination"><span>Hasta ${data.pageSize} células por página; el mapa muestra esta página.</span><div><button class="button secondary" data-territory-page="${data.page-1}" ${data.page<=1?'disabled':''}>Anterior</button><button class="button secondary" data-territory-page="${data.page+1}" ${data.page>=data.pages?'disabled':''}>Siguiente</button></div></div>`:'<p>Sin células para estos filtros. Podés restablecerlos e intentar nuevamente.</p>';
 }
 async function fetchCells(page=1){
  const release=holdLayout(root),current=++sequence;request?.abort();request=new AbortController();error.replaceChildren();status.textContent='Cargando células…';list.innerHTML=skeleton('list');if(!map){mapState.hidden=false;mapState.textContent='Cargando células…';}
  const query=new URLSearchParams([...new FormData(root.querySelector('form'))].filter(([,v])=>v!==''));query.set('page',page);
  const focus=recommendedCell;if(focus)query.set('focus',focus);if(analysis)query.set('analysis','true');
  try{
   const response=options.loadData?null:await fetch('/api/territory/cells?'+query,{signal:request.signal});const value=options.loadData?await options.loadData():await response.json();if(response&&!response.ok){if(response.status===401)window.dispatchEvent(new Event('session-expired'));throw Object.assign(new Error(value.message||'No pudimos cargar las células.'),{status:response.status});}
   if(!active||current!==sequence)return;data=value;if(selected==='central'&&!site()||selected&&selected!=='central'&&!data.items.some(c=>c.id===selected)){selected=null;panel.hidden=true;}textList();renderAnalysis(query);await startMap();if(focus){recommendedCell=null;const c=points().find(c=>c.id===focus);if(c){map?.setView(c,16);select(c.id,false);}}if(selected==='central'){panel.innerHTML=siteDetail(data.central);panel.hidden=false;}else if(selected)select(selected,false);
  }catch(err){if(!active||current!==sequence||err.name==='AbortError')return;data=null;selected=null;renderAnalysis(new URLSearchParams());organizationAbort?.abort();root.querySelector('[data-territory-organization]').replaceChildren();metadata={items:[],geography:[],canManage:false};fillTerritoryFilters(root,metadata);root.querySelector('[data-territory-types]').hidden=true;root.querySelectorAll('[data-territory-legend-type]').forEach(el=>el.hidden=true);root.querySelector('[data-territory-recenter]').disabled=true;panel.hidden=true;panel.replaceChildren();clearMap();disposeSite?.();disposeSite=null;root.querySelector('[data-territory-site]').replaceChildren();root.querySelector('[data-territory-notice]').textContent='';list.replaceChildren();status.textContent='No se pudieron cargar las células.';mapState.hidden=false;mapState.textContent='Mapa no disponible.';error.innerHTML=`<p>${e(err.status===403?'Esta sección no está disponible.':err.message==='Failed to fetch'?'No pudimos conectar con el servidor.':err.message)}</p>${err.status===403?'':'<button class="button secondary" data-territory-retry>Reintentar</button>'}`;}finally{release();}
 }
 on('submit',event=>{if(event.target.matches('[data-territory-filters]')){event.preventDefault();fetchCells();}});
 on('reset',event=>{if(!event.target.matches('[data-territory-filters]'))return;const release=holdLayout(root);resetRelease();resetRelease=release;clearTimeout(resetTimer);list.replaceChildren();panel.hidden=true;status.textContent='Cargando células…';resetTimer=setTimeout(()=>{if(active)fetchCells().finally(release);else release();},0);});
 on('change',event=>{
  if(event.target===coverage)drawCoverage();
  if(event.target.matches('[data-territory-visualization]')){drawMarkers();drawDensity();}
  if(event.target.matches('[data-territory-type]')){
   const type=event.target.dataset.territoryType;if(!event.target.checked&&(type==='CHURCH'&&selected==='central'||type==='CELL'&&selected&&selected!=='central')){selected=null;panel.hidden=true;list.querySelectorAll('[data-territory-select]').forEach(b=>b.setAttribute('aria-pressed','false'));}
   typeTools();drawMarkers();drawCoverage();
  }
 });
 on('click',event=>{
  const target=event.target.closest('button');if(!target)return;
  if(target.hasAttribute('data-territory-select'))select(target.dataset.territorySelect);
  if(target.hasAttribute('data-territory-page'))fetchCells(Number(target.dataset.territoryPage));
  if(target.hasAttribute('data-territory-recenter'))recenter();
  if(target.hasAttribute('data-territory-map-retry'))startMap();
  if(target.hasAttribute('data-territory-retry'))fetchCells();
  if(target.hasAttribute('data-organization-retry'))loadOrganization();
  if(target.hasAttribute('data-territory-close')){selected=null;panel.hidden=true;drawMarkers();drawCoverage();drawSite();list.querySelectorAll('[data-territory-select]').forEach(b=>b.setAttribute('aria-pressed','false'));root.querySelector('[data-territory-recenter]').focus({preventScroll:true});}
 });
 on('submit',async event=>{
  const form=event.target;if(!form.matches('[data-territory-assignment]'))return;event.preventDefault();const c=data?.items.find(c=>c.id===selected);if(!c)return;const button=form.querySelector('button'),message=form.querySelector('[data-assignment-message]');if(button.disabled)return;button.disabled=true;message.textContent='Guardando…';
  try{const saved=await territoryRequest('/cells/'+c.id+'/territory',{method:'PUT',body:JSON.stringify({unitId:form.elements.unitId.value||null,version:c.territoryVersion}),signal:abort.signal});if(active){c.territoryUnitId=saved.unit_id;c.territoryVersion=saved.version;message.textContent='Asignación guardada.';await fetchCells();}}
  catch(err){if(active&&err.name!=='AbortError')message.textContent=err.message;}finally{if(button.isConnected)button.disabled=false;}
 });
 (options.embedded?Promise.resolve():loadOrganization()).then(()=>{if(active)fetchCells();});
}
