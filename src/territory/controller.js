import {escape as e} from '../components.js';
import {skeleton,holdLayout} from '../ui/skeleton.js';
import {mapShell,detail,pinMarkup,ageLabel,sitePin,siteDetail} from './views.js';
import {mountSiteEditor} from './site-editor.js';
import {mappable,coverageRing} from './geometry.js';
import {loadLeaflet} from './leaflet.js';
let dispose=()=>{};
export const territoryRoute=path=>path==='/territorio/mapa';
export function unmountTerritory(){dispose();dispose=()=>{};}
export function mountTerritory(root){
 unmountTerritory();root.innerHTML=mapShell();
 let active=true,data=null,selected=null,map=null,L=null,request=null,sequence=0,tileTimer,resetTimer,resetRelease=()=>{},tiles=null,markers=null,circles=null,markerEntries=new Map(),mapError=false,siteMarker=null,disposeSite=null;
 const abort=new AbortController(),reduced=matchMedia('(prefers-reduced-motion: reduce)'),host=root.querySelector('[data-territory-map]'),status=root.querySelector('[data-territory-status]'),mapState=root.querySelector('[data-territory-map-state]'),panel=root.querySelector('[data-territory-detail]'),list=root.querySelector('[data-territory-list]'),error=root.querySelector('[data-territory-error]'),coverage=root.querySelector('[data-territory-coverage]');
 const on=(type,fn)=>root.addEventListener(type,fn,{signal:abort.signal});
 const points=()=>data?.items.filter(c=>mappable(c)&&c.coordinateStatus==='VERIFIED')||[];
 const site=()=>data?.central?.coordinateStatus==='VERIFIED'&&mappable(data.central)?data.central:null;
 function clearMap(){clearTimeout(tileTimer);map?.remove();map=null;markers=null;circles=null;tiles=null;siteMarker=null;markerEntries.clear();host.replaceChildren();for(const name of [...host.classList])if(name.startsWith('leaflet-'))host.classList.remove(name);}
 const resize=new ResizeObserver(()=>{if(map)map.invalidateSize({animate:false,pan:false});});resize.observe(host);
 dispose=()=>{active=false;sequence++;request?.abort();abort.abort();disposeSite?.();clearTimeout(resetTimer);resetRelease();resize.disconnect();clearMap();};
 function mapFailure(){if(!active||mapError)return;mapError=true;clearTimeout(tileTimer);mapState.hidden=false;mapState.innerHTML='<p>No pudimos cargar el mapa base. Podés consultar las células en el listado.</p><button class="button secondary" data-territory-map-retry>Reintentar mapa</button>';}
 function drawCoverage(){
  if(!map)return;circles.clearLayers();if(!coverage.checked)return;
  for(const c of points()){
   const ring=coverageRing(c);if(!ring.length)continue;
   L.polygon(ring,{color:c.id===selected?'#C85A28':'#80A4B8',weight:c.id===selected?3:1.5,fillColor:c.id===selected?'#D98A3C':'#80A4B8',fillOpacity:c.id===selected?0.15:0.07,interactive:false,className:'territory-coverage'}).addTo(circles);
  }
 }
 function select(id,focus=true){
  const c=data?.items.find(c=>c.id===id);if(!c)return;selected=id;panel.innerHTML=detail(c);panel.hidden=false;
  list.querySelectorAll('[data-territory-select]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.territorySelect===id)));
  // Selecting a detail keeps the user's viewport and zoom.
  drawMarkers();drawCoverage();if(focus)panel.focus({preventScroll:true});
 }
 function drawMarkers(){
  if(!map)return;const visible=new Set();
  const groups=new Map(),bounds=map.getBounds().pad(0.3),zoom=map.getZoom();
  for(const c of points()){
   if(!bounds.contains([c.latitude,c.longitude]))continue;
   const p=map.latLngToContainerPoint([c.latitude,c.longitude]),key=zoom>=17||c.id===selected?c.id:`${Math.floor(p.x/58)}:${Math.floor(p.y/58)}`;
   if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c);
  }
  for(const group of groups.values()){
   const c=group[0],cluster=group.length>1;
   const key=cluster?'cluster:'+group.map(c=>c.id).join(','):c.id;visible.add(key);
   let entry=markerEntries.get(key);
   if(!entry){
   const marker=L.marker([c.latitude,c.longitude],{icon:L.divIcon({className:'territory-marker',html:cluster?`<span class="territory-cluster" aria-hidden="true">${group.length}</span>`:pinMarkup(c.id===selected,c.coordinateStatus!=='VERIFIED'),iconSize:[44,54],iconAnchor:[22,48]}),keyboard:true,autoPanOnFocus:false,title:cluster?`${group.length} células. Acercar mapa.`:`Seleccionar ${c.displayCode}`,zIndexOffset:c.id===selected?1000:0});
   const action=()=>cluster?map.setView([c.latitude,c.longitude],Math.min(17,map.getZoom()+2),{animate:!reduced.matches}):select(c.id);
   marker.on('click',action);marker.on('add',()=>{const element=marker.getElement();element.setAttribute('aria-label',marker.options.title);element.setAttribute('aria-pressed',String(!cluster&&c.id===selected));element.addEventListener('keydown',event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();event.stopPropagation();action();}});});marker.addTo(markers);
    entry={marker};markerEntries.set(key,entry);
   }
   entry.marker.setZIndexOffset(c.id===selected?1000:0);
   entry.marker.setLatLng([c.latitude,c.longitude]);
   const element=entry.marker.getElement();if(element){element.setAttribute('aria-pressed',String(!cluster&&c.id===selected));element.querySelector('.territory-pin')?.classList.toggle('is-selected',c.id===selected);}

  }
  for(const [key,entry]of markerEntries)if(!visible.has(key)){markers.removeLayer(entry.marker);markerEntries.delete(key);}
 }
 function drawSite(){
  const s=site();if(!s){if(siteMarker)map.removeLayer(siteMarker);siteMarker=null;return;}
  if(!siteMarker){siteMarker=L.marker([s.latitude,s.longitude],{icon:L.divIcon({className:'territory-marker territory-site-marker',html:sitePin(),iconSize:[50,62],iconAnchor:[25,54]}),title:s.institution+' — '+s.name,keyboard:true,autoPanOnFocus:false,zIndexOffset:1200}).addTo(map);const selectSite=()=>{selected='central';panel.innerHTML=siteDetail(data.central);panel.hidden=false;siteMarker.getElement()?.querySelector('.territory-pin')?.classList.add('is-selected');panel.focus({preventScroll:true});};siteMarker.on('click',selectSite);siteMarker.getElement()?.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();selectSite();}});}else siteMarker.setLatLng([s.latitude,s.longitude]);
  const element=siteMarker.getElement();if(element){element.title=s.institution+' — '+s.name;element.setAttribute('aria-label',element.title);element.setAttribute('aria-pressed',String(selected==='central'));}
 }
 function recenter(){const items=[...points(),...(site()?[site()]:[])];if(!map)return;if(items.length===1)map.setView([items[0].latitude,items[0].longitude],16,{animate:false});else if(items.length)map.fitBounds(items.map(c=>[c.latitude,c.longitude]),{padding:[38,38],maxZoom:15,animate:!reduced.matches});else map.setView([data.reference.latitude,data.reference.longitude],data.reference.zoom,{animate:false});}
 async function startMap(current=sequence){
  if(map&&!mapError){drawMarkers();drawCoverage();drawSite();return;}
  const previous=map?{center:map.getCenter(),zoom:map.getZoom()}:null;clearMap();mapError=false;
  mapState.hidden=false;mapState.textContent='Cargando mapa…';
  try{
   const library=await Promise.race([loadLeaflet(),new Promise((_,reject)=>{tileTimer=setTimeout(()=>reject(new Error('Map load timeout')),10000);})]);clearTimeout(tileTimer);if(!active||current!==sequence)return;L=library;
   map=L.map(host,{zoomControl:false,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false,scrollWheelZoom:false,attributionControl:true,minZoom:2,maxZoom:19});
   map.attributionControl.setPrefix(false);
   L.control.zoom({zoomInTitle:'Acercar mapa',zoomOutTitle:'Alejar mapa'}).addTo(map);L.control.scale({imperial:false}).addTo(map);
   markers=L.layerGroup().addTo(map);circles=L.layerGroup().addTo(map);
   tiles=L.tileLayer(data.provider.url,{maxZoom:data.provider.maxZoom,noWrap:true,keepBuffer:1,updateWhenIdle:true,referrerPolicy:'origin',attribution:`<a href="${e(data.provider.attributionUrl)}" target="_blank" rel="noopener noreferrer">${e(data.provider.attribution)}</a>`});
   const mountedMap=map;
   tiles.on('tileerror',()=>{if(map===mountedMap)mapFailure();});tiles.on('tileload',()=>{if(active&&map===mountedMap&&!mapError){clearTimeout(tileTimer);mapState.hidden=true;}});tiles.addTo(map);
   tileTimer=setTimeout(mapFailure,10000);map.on('moveend',drawMarkers);map.on('resize',drawMarkers);if(previous)map.setView(previous.center,previous.zoom,{animate:false});else recenter();drawMarkers();drawCoverage();drawSite();
  }catch{mapFailure();}
 }
 function textList(){
  const notice=root.querySelector('[data-territory-notice]');notice.textContent=[!points().length?'Todavía no hay células ubicadas en el mapa. Podés comenzar registrando sus lugares de reunión.':'',!points().length&&!site()?data.reference.label+' · sin ubicaciones verificadas.':'',data.canManageSite&&!site()?'Sede central pendiente de confirmar.':''].filter(Boolean).join(' ');if(data.canManageCells&&!points().length)notice.insertAdjacentHTML('beforeend',' <a href="#/oficina/celulas">Gestionar células</a>');
  const settings=root.querySelector('[data-territory-site]');settings.hidden=!data.canManageSite;if(data.canManageSite&&!disposeSite)disposeSite=mountSiteEditor(settings,{onSaved:s=>{data.central={...s,locationAccuracy:s.verification?.accuracy};drawSite();textList();}});
  const missing=data.missingLocation,limited=data.items.filter(c=>!mappable(c)&&c.latitude!=null).length;
  status.textContent=`${data.total} células · ${missing} sin coordenadas válidas${limited?' · '+limited+' fuera de la proyección del mapa base':''}. Página ${data.page} de ${data.pages}.`;
  list.innerHTML=data.items.length?`<ul>${data.items.map(c=>`<li><button class="territory-cell" data-territory-select="${e(c.id)}" aria-pressed="false"><strong>${e(c.displayCode)}</strong><span>${e(c.locality||'Sin localidad')} · ${e(ageLabel(c))}</span><small>${!mappable(c)?'Ubicación no representable en el mapa':c.coordinateStatus==='VERIFIED'?'Verificada manualmente':'Pendiente de verificar'}</small></button></li>`).join('')}</ul><div class="people-pagination"><span>Hasta ${data.pageSize} células por página; el mapa muestra esta página.</span><div><button class="button secondary" data-territory-page="${data.page-1}" ${data.page<=1?'disabled':''}>Anterior</button><button class="button secondary" data-territory-page="${data.page+1}" ${data.page>=data.pages?'disabled':''}>Siguiente</button></div></div>`:'<p>Sin células para estos filtros. Podés restablecerlos e intentar nuevamente.</p>';
 }
 async function fetchCells(page=1){
  const release=holdLayout(root),current=++sequence;request?.abort();request=new AbortController();selected=null;panel.hidden=true;error.replaceChildren();status.textContent='Cargando células…';list.innerHTML=skeleton('list');if(!map){mapState.hidden=false;mapState.textContent='Cargando células…';}
  const query=new URLSearchParams([...new FormData(root.querySelector('form'))].filter(([,v])=>v!==''));query.set('page',page);
  try{
   const response=await fetch('/api/territory/cells?'+query,{signal:request.signal});const value=await response.json();if(!response.ok){if(response.status===401)window.dispatchEvent(new Event('session-expired'));throw Object.assign(new Error(value.message||'No pudimos cargar las células.'),{status:response.status});}
   if(!active||current!==sequence)return;data=value;textList();await startMap(current);
  }catch(err){if(!active||current!==sequence||err.name==='AbortError')return;data=null;clearMap();disposeSite?.();disposeSite=null;root.querySelector('[data-territory-site]').replaceChildren();root.querySelector('[data-territory-notice]').textContent='';list.replaceChildren();status.textContent='No se pudieron cargar las células.';mapState.hidden=false;mapState.textContent='Mapa no disponible.';error.innerHTML=`<p>${e(err.status===403?'Esta sección no está disponible.':err.message==='Failed to fetch'?'No pudimos conectar con el servidor.':err.message)}</p>${err.status===403?'':'<button class="button secondary" data-territory-retry>Reintentar</button>'}`;}finally{release();}
 }
 on('submit',event=>{if(event.target.matches('[data-territory-filters]')){event.preventDefault();fetchCells();}});
 on('reset',event=>{if(!event.target.matches('[data-territory-filters]'))return;const release=holdLayout(root);resetRelease();resetRelease=release;clearTimeout(resetTimer);list.replaceChildren();panel.hidden=true;status.textContent='Cargando células…';resetTimer=setTimeout(()=>{if(active)fetchCells().finally(release);else release();},0);});
 on('change',event=>{if(event.target===coverage)drawCoverage();});
 on('click',event=>{
  const target=event.target.closest('button');if(!target)return;
  if(target.hasAttribute('data-territory-select'))select(target.dataset.territorySelect);
  if(target.hasAttribute('data-territory-page'))fetchCells(Number(target.dataset.territoryPage));
  if(target.hasAttribute('data-territory-recenter'))recenter();
  if(target.hasAttribute('data-territory-map-retry'))startMap();
  if(target.hasAttribute('data-territory-retry'))fetchCells();
  if(target.hasAttribute('data-territory-close')){selected=null;panel.hidden=true;siteMarker?.getElement()?.querySelector('.territory-pin')?.classList.remove('is-selected');drawMarkers();drawCoverage();drawSite();list.querySelectorAll('[data-territory-select]').forEach(b=>b.setAttribute('aria-pressed','false'));root.querySelector('[data-territory-recenter]').focus({preventScroll:true});}
 });
 fetchCells();
}
