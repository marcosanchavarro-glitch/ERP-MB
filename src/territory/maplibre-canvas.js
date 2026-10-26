import {loadMapLibre} from './maplibre.js';
import {coverageRing} from './geometry.js';
import {escape as e} from '../components.js';
const coord=p=>[p.longitude,p.latitude];
export async function mapLibreCanvas(host,{provider,center,onMove,onReady,onError,onClick,signal}){
 const M=await loadMapLibre();if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 const vector=Boolean(provider.geoapify?.configured),dark=()=>document.documentElement.dataset.theme==='dark';
 const style=()=>vector?(dark()?provider.geoapify.dark:provider.geoapify.light):{version:8,sources:{base:{type:'raster',tiles:[provider.url],tileSize:256,maxzoom:provider.maxZoom,attribution:`<a href="${e(provider.attributionUrl)}" target="_blank" rel="noopener noreferrer">${e(provider.attribution)}</a>`}},layers:[{id:'base',type:'raster',source:'base'}]};
 let map;try{map=new M.Map({container:host,style:style(),center:coord(center),zoom:center.zoom??10,minZoom:2,maxZoom:19,pitch:0,bearing:0,locale:{'NavigationControl.ZoomIn':'Acercar mapa','NavigationControl.ZoomOut':'Alejar mapa','AttributionControl.ToggleAttribution':'Mostrar atribución','CooperativeGesturesHandler.WindowsHelpText':'Usá Ctrl + desplazamiento para acercar el mapa','CooperativeGesturesHandler.MacHelpText':'Usá ⌘ + desplazamiento para acercar el mapa','CooperativeGesturesHandler.MobileHelpText':'Usá dos dedos para mover el mapa'},renderWorldCopies:false,cooperativeGestures:true,attributionControl:false,refreshExpiredTiles:false,fadeDuration:0,transformRequest:url=>({url,referrerPolicy:'origin'})});}catch(error){host.replaceChildren();throw error;}
 host.dataset.mapEngine='maplibre';host.dataset.mapStyle=vector?(dark()?provider.geoapify.darkStyle:provider.geoapify.lightStyle):'raster-backup';
 const markers=new Set(),areas=new Map();let areaId=0,queued=false,active=true,ready=false;
 map.addControl(new M.NavigationControl({showCompass:false}),'top-left');map.addControl(new M.ScaleControl({unit:'metric'}),'bottom-left');
 map.addControl(new M.AttributionControl({compact:true}),'bottom-right');
 map.dragRotate.disable();map.touchZoomRotate.disableRotation();
 const syncAreas=()=>{queued=false;if(!active||!map.isStyleLoaded())return;const data={type:'FeatureCollection',features:[...areas.values()]};
  if(!map.getSource('halo-coverage')){map.addSource('halo-coverage',{type:'geojson',data});map.addLayer({id:'halo-coverage-fill',type:'fill',source:'halo-coverage',paint:{'fill-color':['case',['get','selected'],'#D98A3C','#80A4B8'],'fill-opacity':['case',['get','selected'],0.15,0.07]}});map.addLayer({id:'halo-coverage-line',type:'line',source:'halo-coverage',paint:{'line-color':['case',['get','selected'],'#C85A28','#80A4B8'],'line-width':['case',['get','selected'],3,1.5]}});}else map.getSource('halo-coverage').setData(data);
 };
 const scheduleAreas=()=>{if(!queued){queued=true;queueMicrotask(syncAreas);}};
 const loaded=()=>{if(!active)return;syncAreas();if(!ready){ready=true;onReady();}};
 const moved=()=>onMove(),clicked=event=>onClick({latitude:event.lngLat.lat,longitude:event.lngLat.lng}),failed=()=>{if(active)onError();};
 const styled=()=>{
  // Native vector paint adjustments, never a CSS filter over labels or tiles.
  if(vector&&dark())for(const layer of map.getStyle().layers){
   const source=layer['source-layer'],id=layer.id.toLowerCase();
   if(layer.type==='background')map.setPaintProperty(layer.id,'background-color','#17212A');
   if(layer.type==='fill'){
    if(source==='water')map.setPaintProperty(layer.id,'fill-color','#203E53');
    if(source==='building'){map.setPaintProperty(layer.id,'fill-color','#2C3945');map.setPaintProperty(layer.id,'fill-outline-color','#485864');}
    if(['landcover','landuse','park'].includes(source))map.setPaintProperty(layer.id,'fill-color','#253A33');
   }
   if(layer.type==='line'&&source==='transportation')map.setPaintProperty(layer.id,'line-color',/casing|case|outline/.test(id)?'#263541':/motorway|trunk|primary/.test(id)?'#A3AAA9':'#687986');
   if(layer.type==='symbol'&&layer.layout?.['text-field']){map.setPaintProperty(layer.id,'text-color','#D6E0E7');map.setPaintProperty(layer.id,'text-halo-color','#17212A');map.setPaintProperty(layer.id,'text-halo-width',1);}
  }
  syncAreas();
 };
 map.on('load',loaded);map.on('style.load',styled);map.on('moveend',moved);map.on('resize',moved);map.on('click',clicked);map.on('error',failed);
 const theme=new MutationObserver(()=>{if(!active||!vector)return;const next=dark()?provider.geoapify.darkStyle:provider.geoapify.lightStyle;if(host.dataset.mapStyle===next)return;host.dataset.mapStyle=next;map.setStyle(style());});theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 return {kind:'maplibre',fallbackReason:vector?'':'MISSING_CONFIG',
  view:()=>({latitude:map.getCenter().lat,longitude:map.getCenter().lng,zoom:map.getZoom()}),
  setView:(p,zoom)=>map.jumpTo({center:coord(p),zoom}),
  fit(points){const bounds=new M.LngLatBounds();points.forEach(p=>bounds.extend(coord(p)));map.fitBounds(bounds,{padding:38,maxZoom:15,duration:0});},
  contains:p=>map.getBounds().contains(coord(p)),project:p=>map.project(coord(p)),
  marker({point,html,title,onSelect=()=>{},draggable=false,onDrag=()=>{}}){
   const element=document.createElement('button');element.type='button';element.className='territory-marker territory-maplibre-marker';element.innerHTML=html;element.title=title;element.setAttribute('aria-label',title);
   const select=event=>{event.stopPropagation();onSelect();};element.addEventListener('click',select);
   const marker=new M.Marker({element,anchor:'bottom',offset:[0,7],draggable}).setLngLat(coord(point)).addTo(map);markers.add(marker);
   marker.on('dragend',()=>{const p=marker.getLngLat();onDrag({latitude:p.lat,longitude:p.lng});});
   return {element,update(p,selected=false,zIndex=0,label=title){marker.setLngLat(coord(p));element.style.zIndex=String(zIndex);element.title=label;element.setAttribute('aria-label',label);element.setAttribute('aria-pressed',String(selected));element.querySelector('.territory-pin')?.classList.toggle('is-selected',selected);},remove(){element.removeEventListener('click',select);marker.remove();markers.delete(marker);}};
  },
  circle(c,selected){const ring=coverageRing(c);if(!ring.length)return ()=>{};const coordinates=ring.map(([lat,lng])=>[lng,lat]);coordinates.push(coordinates[0]);const id=++areaId;areas.set(id,{type:'Feature',properties:{selected:Boolean(selected)},geometry:{type:'Polygon',coordinates:[coordinates]}});scheduleAreas();return ()=>{areas.delete(id);scheduleAreas();};},
  resize:()=>map.resize(),destroy(){active=false;theme.disconnect();for(const marker of markers)marker.remove();markers.clear();areas.clear();map.remove();host.replaceChildren();delete host.dataset.mapEngine;delete host.dataset.mapStyle;}
 };
}
