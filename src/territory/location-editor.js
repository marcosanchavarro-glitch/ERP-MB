import {escape as e} from '../components.js';
import {sessionState} from '../auth/session.js';
import {createMapCanvas} from './map-canvas.js';
export const accuracyLabels={EXACT:'Dirección y altura · coincidencia precisa',STREET:'Calle aproximada · revisá el punto',LOCALITY:'Solo localidad o zona · no es un domicilio exacto',MANUAL:'Punto ajustado y confirmado manualmente'};
export const locationEditorMarkup=()=>`<section class="location-editor" aria-label="Buscar y confirmar ubicación"><p class="subtle">Buscar envía únicamente dirección, localidad, provincia y país a Geoapify. La búsqueda no guarda ni verifica el punto.</p><div class="cell-actions"><button type="button" class="button secondary" data-location-search>Buscar ubicación</button><button type="button" class="button secondary" data-location-manual>Ubicar manualmente</button></div><p data-location-message role="status" aria-live="polite"></p><div data-location-candidates></div><div data-location-preview class="location-preview" role="region" aria-label="Vista previa de ubicación. Podés arrastrar el pin o usar los campos de coordenadas." hidden></div><p data-location-provider class="subtle" role="status" hidden></p><button type="button" class="button secondary" data-location-confirm hidden>Confirmar punto para guardar</button><p class="subtle"><a href="https://www.geoapify.com/" target="_blank" rel="noopener">Powered by Geoapify</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a></p><p data-location-attribution class="subtle"></p></section>`;
export async function locationRequest(path,options={}){const response=await fetch('/api/locations'+path,{...options,headers:{'Content-Type':'application/json','X-CSRF-Token':sessionState.csrfToken||''}});const data=await response.json();if(!response.ok){if(response.status===401)window.dispatchEvent(new Event('session-expired'));throw new Error(data.message||'No pudimos cargar la ubicación.');}return data;}
export function mountLocationEditor(form,{kind,id,onDirty=()=>{}}){
 const root=form.querySelector('.location-editor'),message=root.querySelector('[data-location-message]'),preview=root.querySelector('[data-location-preview]'),confirm=root.querySelector('[data-location-confirm]'),results=root.querySelector('[data-location-candidates]'),abort=new AbortController();
 let map,marker,creating,settings,search=null,index=null,manual=true,confirmed=null,sequence=0,active=true;
 const keys=['address','locality','province','country'],field=k=>form.elements.namedItem(k),address=()=>Object.fromEntries(keys.map(k=>[k,field(k)?.value||''])),snapshot=()=>JSON.stringify([...keys,'latitude','longitude'].map(k=>field(k)?.value||''));
 const point=()=>({latitude:field('latitude').value===''?null:Number(field('latitude').value),longitude:field('longitude').value===''?null:Number(field('longitude').value)});
 const valid=p=>p.latitude!=null&&p.longitude!=null&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=85.05112878&&Math.abs(p.longitude)<=180;
 function invalidate(){confirmed=null;confirm.hidden=false;if(field('coordinateStatus'))field('coordinateStatus').value=valid(point())?'PENDING':'';onDirty();}
 function updatePoint(p){field('latitude').value=p.latitude.toFixed(7);field('longitude').value=p.longitude.toFixed(7);invalidate();}
 async function show(p,forceFallback=false){
  preview.hidden=false;
  if(forceFallback){marker?.remove();marker=null;map?.destroy();map=null;}
  if(!map){
   settings??=await locationRequest('/settings');
   creating??=createMapCanvas(preview,{provider:forceFallback?{...settings.provider,geoapify:{configured:false}}:settings.provider,center:valid(p)?{...p,zoom:16}:settings.reference,signal:abort.signal,onClick:p=>{manual=true;updatePoint(p);place(point());message.textContent='Punto ajustado. Revisalo y confirmalo.';},onError:()=>{if(map?.kind==='maplibre'&&!map.fallbackReason)show(point(),true).catch(()=>{message.textContent='No pudimos cargar el mapa. Podés completar las coordenadas manualmente.';});else message.textContent='No pudimos cargar el mapa. Podés completar las coordenadas manualmente.';}}).finally(()=>{creating=null;});
   const canvas=await creating;if(!active){canvas.destroy();return;}map=canvas;
  }
  if(!active)return;map.resize();const current=point(),center=valid(current)?current:settings.reference;map.setView(center,valid(current)?16:settings.reference.zoom);if(valid(current))place(current);
  const status=root.querySelector('[data-location-provider]');status.hidden=!map.fallbackReason;status.textContent='Cartografía de respaldo · Geoapify no está disponible o requiere configuración.';
 }
 function place(p){if(!valid(p)||!map)return;if(!marker)marker=map.marker({point:p,html:'<span class="location-preview-pin" aria-hidden="true">◆</span>',title:'Punto propuesto. Arrastrá para ajustar.',draggable:true,onDrag:p=>{manual=true;updatePoint(p);message.textContent='Punto ajustado. Revisalo y confirmalo.';}});else marker.update(p);}
 root.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button===confirm){if(!valid(point())){message.textContent='Elegí un punto en el mapa o completá ambas coordenadas.';return;}confirmed={snapshot:snapshot(),value:{manual,...(search&&index!=null?{searchKey:search.searchKey,candidateIndex:index}:{})}};if(field('coordinateStatus'))field('coordinateStatus').value='VERIFIED';message.textContent='Punto confirmado. Se guardará al guardar el formulario.';confirm.hidden=true;onDirty();return;}
  const current=++sequence;
  try{
   if(button.hasAttribute('data-location-search')){
    button.disabled=true;confirmed=null;message.textContent='Buscando ubicación…';const before=snapshot();const value=await locationRequest(`/search/${kind}/${id}`,{method:'POST',body:JSON.stringify(address()),signal:abort.signal});if(!active||current!==sequence||before!==snapshot())return;search=value;index=null;manual=true;
    results.innerHTML=value.candidates.length?`<fieldset><legend>Elegí un resultado; ninguno se selecciona automáticamente</legend>${value.candidates.map((c,i)=>`<label><input type="radio" name="locationCandidate" value="${i}"> ${e(c.label)}<small>${e(accuracyLabels[c.accuracy])}</small></label>`).join('')}</fieldset>`:'';
    message.textContent=value.candidates.length?'Revisá la precisión y seleccioná una opción.':'Dirección no encontrada. Podés ubicar el punto manualmente.';
   }else if(button.hasAttribute('data-location-manual')){manual=true;search=null;index=null;results.replaceChildren();invalidate();await show(point());message.textContent='Hacé clic en el mapa, arrastrá el pin o completá las coordenadas. Luego confirmá el punto.';}
  }catch(error){if(active&&error.name!=='AbortError')message.textContent=error.message;}finally{button.disabled=false;}
 },{signal:abort.signal});
 root.addEventListener('change',async event=>{if(event.target.name!=='locationCandidate')return;try{index=Number(event.target.value);manual=false;const c=search.candidates[index];field('latitude').value=String(c.latitude);field('longitude').value=String(c.longitude);invalidate();root.querySelector('[data-location-attribution]').textContent=c.attribution;await show(c);message.textContent=accuracyLabels[c.accuracy]+'. Confirmá solo después de revisar el punto.';}catch(error){message.textContent=error.message;}},{signal:abort.signal});
 form.addEventListener('input',event=>{if([...keys,'latitude','longitude'].includes(event.target.name)){sequence++;if(keys.includes(event.target.name)){search=null;index=null;results.replaceChildren();}manual=true;invalidate();if(valid(point()))place(point());message.textContent='Ubicación modificada. Revisá y confirmá el punto.';}},{signal:abort.signal});
 return {confirmation:()=>confirmed?.snapshot===snapshot()?confirmed.value:undefined,destroy(){active=false;sequence++;abort.abort();marker?.remove();map?.destroy();}};
}
