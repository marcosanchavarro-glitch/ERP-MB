import {escape as e} from '../components.js';

// Entity-derived categories. Future types are reserved, not enabled as features.
export const locationTypes=Object.freeze({
 CHURCH:Object.freeze({label:'Sede',implemented:true}),
 CELL:Object.freeze({label:'Célula',implemented:true}),
 EVANGELISM:Object.freeze({label:'Evangelismo',implemented:false}),
 EVENT:Object.freeze({label:'Evento',implemented:false}),
 POINT_OF_INTEREST:Object.freeze({label:'Punto de interés',implemented:false})
});
const localLogo=resource=>typeof resource==='string'&&/^\/src\/[a-zA-Z0-9/_-]+\.(svg|png|webp|jpg)$/.test(resource)&&!resource.includes('..');
export function institutionalVisual(resource){
 const logo=localLogo(resource);
 return `<span class="territory-brand-visual">${logo?`<img data-institutional-logo src="${e(resource)}" alt="Logo institucional">`:''}<span data-logo-fallback ${logo?'hidden':''}><strong class="territory-site-caption">Sede</strong><small>Provisional</small></span></span>`;
}
export function markerMarkup({type,id='',selected=false,pending=false,visualResource=null,count=0}){
 if(!locationTypes[type]?.implemented)throw new TypeError('Unsupported location marker type');
 const metadata=`data-location-type="${type}" data-location-id="${e(id)}"`;
 if(type==='CELL'&&count>1)return `<span class="territory-cluster" ${metadata} aria-hidden="true">${e(count)}</span>`;
 const classes=`territory-pin ${type==='CHURCH'?'territory-site-pin':'territory-cell-pin'} ${selected?'is-selected':''} ${pending?'is-pending':''}`;
 if(type==='CHURCH')return `<span class="${classes}" ${metadata} aria-hidden="true"><span class="territory-site-badge">${institutionalVisual(visualResource)}</span><span class="territory-site-tip"></span></span>`;
 return `<span class="${classes}" ${metadata} aria-hidden="true"><svg viewBox="0 0 40 52" focusable="false"><ellipse cx="20" cy="46" rx="12" ry="3" class="pin-ground"/><path d="M20 45C17 39 5 27 5 18a15 15 0 0 1 30 0c0 9-12 21-15 27Z" class="pin-body"/><path d="M20 4a14 14 0 0 0-13 14c0 7 7 16 13 23Z" class="pin-light"/><path d="m10 19 10-9 10 9M13 17v13h14V17M18 30v-8h5v8" class="territory-house"/><path d="m13 30 3 2h14V19l-3-2v13Z" class="territory-house-depth"/></svg></span>`;
}
// Geographic data, presentation and click behavior remain separate from the map engine.
export function locationMarker({type,id,coordinates,selected=false,context={},visualResource=null}){
 return {point:coordinates,title:context.title||locationTypes[type]?.label,html:markerMarkup({type,id,selected,visualResource,count:context.count})};
}
export function markerAssetError(event){
 const image=event.target;if(!image.matches?.('img[data-institutional-logo]'))return;
 image.hidden=true;const fallback=image.parentElement.querySelector('[data-logo-fallback]');if(fallback)fallback.hidden=false;
}
