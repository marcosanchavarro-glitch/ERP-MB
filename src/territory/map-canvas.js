import {loadLeaflet} from './leaflet.js';
import {mapLibreCanvas} from './maplibre-canvas.js';
import {coverageRing} from './geometry.js';
import {escape as e} from '../components.js';
export async function createMapCanvas(host,{provider,center,onMove=()=>{},onReady=()=>{},onError=()=>{},onClick=()=>{},signal}={}){
 if(!provider.rasterOnly){try{return await mapLibreCanvas(host,{provider,center,onMove,onReady,onError,onClick,signal});}catch(error){if(error.name==='AbortError')throw error;host.replaceChildren();delete host.dataset.mapEngine;}}
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 const canvas=await leafletCanvas(host,{provider,center,onMove,onReady,onError,onClick,signal});return {...canvas,fallbackReason:'WEBGL_UNAVAILABLE'};
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
