// Contract double only. This is NOT Google cartography or a valid-key test.
window.googleTest={maps:[],markers:[],circles:[]};
const ll=p=>({lat:()=>p.lat,lng:()=>p.lng}),asLiteral=p=>({lat:typeof p.lat==='function'?p.lat():p.lat,lng:typeof p.lng==='function'?p.lng():p.lng});
class TestMap{
 constructor(host,options){this.host=host;this.options=options;this.center=options.center;this.zoom=options.zoom;this.events=new Map();host.classList.add('google-test-map');const label=document.createElement('p');label.textContent='SDK simulado para pruebas; no es cartografía Google real.';host.append(label);window.googleTest.maps.push(this);queueMicrotask(()=>{this.emit('idle');this.emit('tilesloaded');});}
 addListener(name,fn){if(!this.events.has(name))this.events.set(name,new Set());this.events.get(name).add(fn);return {remove:()=>this.events.get(name)?.delete(fn)};}
 emit(name,value){for(const fn of [...this.events.get(name)||[]])fn(value);}
 getCenter(){return ll(this.center);}getZoom(){return this.zoom;}
 setCenter(p){this.center=p;queueMicrotask(()=>this.emit('idle'));}setZoom(z){this.zoom=z;queueMicrotask(()=>this.emit('idle'));}
 fitBounds(bounds){this.center={lat:bounds.items.reduce((s,p)=>s+p.lat,0)/bounds.items.length,lng:bounds.items.reduce((s,p)=>s+p.lng,0)/bounds.items.length};this.zoom=12;queueMicrotask(()=>this.emit('idle'));}
 getBounds(){return {contains:()=>true};}getProjection(){return {fromLatLngToPoint:p=>{const v=asLiteral(p);return {x:(v.lng+180)/360*256,y:(90-v.lat)/180*256};}};}
}
class Marker extends HTMLElement{
 constructor(options){super();Object.assign(this,options);this.title=options.title;this.setAttribute('role','button');this.tabIndex=0;this.style.cssText='display:inline-block;position:relative;margin:24px;vertical-align:top';this.addEventListener('click',()=>this.dispatchEvent(new Event('gmp-click')));this.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.dispatchEvent(new Event('gmp-click'));}});window.googleTest.markers.push(this);}
 set map(value){this._map=value;if(value)value.host.append(this);else this.remove();}get map(){return this._map;}
}
customElements.define('google-test-marker',Marker);
class Circle{constructor(options){Object.assign(this,options);window.googleTest.circles.push(this);}setMap(map){this.map=map;}}
class Bounds{constructor(){this.items=[];}extend(p){this.items.push(asLiteral(p));return this;}}
const maps={Map:TestMap,Circle,LatLng:class{constructor(p){Object.assign(this,ll(p));}},LatLngBounds:Bounds,RenderingType:{VECTOR:'VECTOR'},ColorScheme:{DARK:'DARK',LIGHT:'LIGHT'},marker:{AdvancedMarkerElement:Marker},event:{clearInstanceListeners:map=>map.events.clear(),trigger:(map,event)=>map.emit(event)},importLibrary:async()=>maps};
window.google={maps};window[new URL(document.currentScript.src).searchParams.get('callback')]();
