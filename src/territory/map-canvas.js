import {loadLeaflet} from './leaflet.js';
import {loadGoogleMaps} from './google.js';
import {coverageRing} from './geometry.js';
import {escape as e} from '../components.js';
const latLng=p=>({lat:p.latitude,lng:p.longitude});
export async function createMapCanvas(host,{provider,center,onMove=()=>{},onReady=()=>{},onError=()=>{},onClick=()=>{},signal}={}){
 let fallbackReason=provider.google?.configured?'':'MISSING_CONFIG';
 if(provider.google?.configured){try{const maps=await loadGoogleMaps(provider.google);if(signal?.aborted)throw new DOMException('Aborted','AbortError');return googleCanvas(host,{maps,provider,center,onMove,onReady,onError,onClick});}catch(error){if(error.name==='AbortError')throw error;host.replaceChildren();delete host.dataset.mapEngine;fallbackReason='GOOGLE_UNAVAILABLE';}}
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 const canvas=await leafletCanvas(host,{provider,center,onMove,onReady,onError,onClick,signal});return {...canvas,fallbackReason};
}
function googleCanvas(host,{maps:G,provider,center,onMove,onReady,onError,onClick}){
 const map=new G.Map(host,{center:latLng(center),zoom:center.zoom??10,mapId:provider.google.mapId,renderingType:G.RenderingType.VECTOR,colorScheme:document.documentElement.dataset.theme==='dark'?G.ColorScheme.DARK:G.ColorScheme.LIGHT,mapTypeId:'roadmap',gestureHandling:'cooperative',streetViewControl:false,mapTypeControl:false,fullscreenControl:false,zoomControl:true,cameraControl:false,keyboardShortcuts:true,tilt:0,heading:0});
 host.dataset.mapEngine='google';let ready=false;const overlays=new Set(),listeners=[],readinessTimer=setTimeout(()=>onError(),15000);
 const authError=()=>{clearTimeout(readinessTimer);onError();};window.addEventListener('halo-google-auth-failure',authError);
 listeners.push(map.addListener('idle',onMove),map.addListener('click',event=>{if(event.latLng)onClick({latitude:event.latLng.lat(),longitude:event.latLng.lng()});}),map.addListener('tilesloaded',()=>{clearTimeout(readinessTimer);if(map.getMapCapabilities?.()?.isAdvancedMarkersAvailable===false){onError();return;}if(!ready){ready=true;onReady();}}));
 const remove=o=>{o.map=undefined;if(o.setMap)o.setMap(null);overlays.delete(o);};
 return {kind:'google',fallbackReason:'',
  view:()=>({latitude:map.getCenter().lat(),longitude:map.getCenter().lng(),zoom:map.getZoom()}),
  setView:(p,zoom)=>{map.setCenter(latLng(p));map.setZoom(zoom);},
  fit(points){const bounds=new G.LatLngBounds();points.forEach(p=>bounds.extend(latLng(p)));map.fitBounds(bounds,38);const handle=map.addListener('idle',()=>{handle.remove();if(map.getZoom()>15)map.setZoom(15);});listeners.push(handle);},
  contains:p=>!map.getBounds()||map.getBounds().contains(latLng(p)),
  project(p){const projection=map.getProjection();if(!projection)return {x:0,y:0};const point=projection.fromLatLngToPoint(new G.LatLng(latLng(p))),scale=2**map.getZoom();return {x:point.x*scale,y:point.y*scale};},
  marker({point,html,title,onSelect=()=>{},draggable=false,onDrag=()=>{}}){
   const content=document.createElement('span');content.className='territory-marker';content.innerHTML=html;
   const marker=new G.marker.AdvancedMarkerElement({map,position:latLng(point),title,gmpClickable:true,gmpDraggable:draggable});marker.append(content);overlays.add(marker);
   marker.addEventListener('gmp-click',onSelect);marker.addEventListener('gmp-dragend',()=>{const p=marker.position;onDrag({latitude:typeof p.lat==='function'?p.lat():p.lat,longitude:typeof p.lng==='function'?p.lng():p.lng});});
   return {element:marker,update(p,selected=false,zIndex=0,label=title){marker.position=latLng(p);marker.zIndex=zIndex;marker.title=label;marker.setAttribute('aria-pressed',String(selected));content.querySelector('.territory-pin')?.classList.toggle('is-selected',selected);},remove(){marker.removeEventListener('gmp-click',onSelect);remove(marker);}};
  },
  circle(c,selected){const circle=new G.Circle({map,center:latLng(c),radius:c.coverageRadiusMeters,strokeColor:selected?'#C85A28':'#80A4B8',strokeWeight:selected?3:1.5,fillColor:selected?'#D98A3C':'#80A4B8',fillOpacity:selected?0.15:0.07,clickable:false});overlays.add(circle);return ()=>remove(circle);},
  resize(){G.event.trigger(map,'resize');},
  destroy(){clearTimeout(readinessTimer);window.removeEventListener('halo-google-auth-failure',authError);listeners.forEach(l=>l.remove());for(const o of [...overlays])remove(o);G.event.clearInstanceListeners(map);host.replaceChildren();delete host.dataset.mapEngine;}
 };
}
async function leafletCanvas(host,{provider,center,onMove,onReady,onError,onClick,signal}){
 const L=await loadLeaflet();if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 const map=L.map(host,{zoomControl:false,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false,scrollWheelZoom:false,minZoom:2,maxZoom:19});host.dataset.mapEngine='leaflet';map.attributionControl.setPrefix(false);
 L.control.zoom({zoomInTitle:'Acercar mapa',zoomOutTitle:'Alejar mapa'}).addTo(map);L.control.scale({imperial:false}).addTo(map);
 const tiles=L.tileLayer(provider.url,{maxZoom:provider.maxZoom,noWrap:true,keepBuffer:1,updateWhenIdle:true,referrerPolicy:'origin',attribution:`<a href="${e(provider.attributionUrl)}" target="_blank" rel="noopener noreferrer">${e(provider.attribution)}</a>`});
 tiles.on('tileerror',onError);tiles.on('tileload',onReady);tiles.addTo(map);map.on('moveend',onMove);map.on('resize',onMove);map.on('click',event=>onClick({latitude:event.latlng.lat,longitude:event.latlng.lng}));map.setView([center.latitude,center.longitude],center.zoom??10);
 return {kind:'leaflet',view:()=>({latitude:map.getCenter().lat,longitude:map.getCenter().lng,zoom:map.getZoom()}),setView:(p,z)=>map.setView([p.latitude,p.longitude],z,{animate:false}),fit:points=>map.fitBounds(points.map(p=>[p.latitude,p.longitude]),{padding:[38,38],maxZoom:15,animate:false}),contains:p=>map.getBounds().pad(.3).contains([p.latitude,p.longitude]),project:p=>map.project([p.latitude,p.longitude],map.getZoom()),
  marker({point,html,title,onSelect=()=>{},draggable=false,onDrag=()=>{}}){const marker=L.marker([point.latitude,point.longitude],{icon:L.divIcon({className:'territory-marker',html,iconSize:[50,62],iconAnchor:[25,54]}),title,draggable,keyboard:true,autoPanOnFocus:false}).addTo(map),element=marker.getElement();element.setAttribute('aria-label',title);const key=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();onSelect();}};element.addEventListener('keydown',key);marker.on('click',onSelect);marker.on('dragend',()=>{const p=marker.getLatLng();onDrag({latitude:p.lat,longitude:p.lng});});return {element,update(p,selected=false,z=0,label=title){marker.setLatLng([p.latitude,p.longitude]);marker.setZIndexOffset(z);element.title=label;element.setAttribute('aria-label',label);element.setAttribute('aria-pressed',String(selected));element.querySelector('.territory-pin')?.classList.toggle('is-selected',selected);},remove(){element.removeEventListener('keydown',key);map.removeLayer(marker);}};},
  circle(c,selected){const polygon=L.polygon(coverageRing(c),{color:selected?'#C85A28':'#80A4B8',weight:selected?3:1.5,fillColor:selected?'#D98A3C':'#80A4B8',fillOpacity:selected?0.15:0.07,interactive:false,className:'territory-coverage'}).addTo(map);return ()=>map.removeLayer(polygon);},resize:()=>map.invalidateSize({animate:false,pan:false}),destroy(){map.remove();host.replaceChildren();delete host.dataset.mapEngine;}}
}
