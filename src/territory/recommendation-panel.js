import {escape as e} from '../components.js';
import {skeleton,holdLayout} from '../ui/skeleton.js';
import {sessionState} from '../auth/session.js';
import {cellGenders} from '../domain/cell.js';
import {ageLabel} from './views.js';
import {mountLocationEditor,locationEditorMarkup} from './location-editor.js';

async function request(id,options={}){
 const r=await fetch('/api/territory/recommendations/'+id,{...options,headers:{'Content-Type':'application/json','X-CSRF-Token':sessionState.csrfToken||''}});
 const data=await r.json();if(!r.ok){if(r.status===401)window.dispatchEvent(new Event('session-expired'));throw new Error(data.message||'No pudimos consultar las recomendaciones.');}return data;
}
const distance=n=>n<1000?`${Math.round(n)} m`:`${(n/1000).toLocaleString('es-AR',{maximumFractionDigits:1})} km`;
const ageReason=c=>c.ageCompatibility==='MATCH'?'Edad compatible':c.ageCompatibility==='ALTERNATIVE'?'Alternativa: fuera del rango recomendado':'Edad o rango sin información suficiente';
export async function loadPersonRecommendations(root,id){
 const host=root.querySelector('[data-person-recommendations]');if(!host)return;
 let editor=null,saving=false,active=true;
 const abort=new AbortController(),observer=new MutationObserver(()=>{if(!host.isConnected){active=false;abort.abort();editor?.destroy();observer.disconnect();}});
 observer.observe(document.body,{childList:true,subtree:true});
 async function load(){
  const release=holdLayout(host);editor?.destroy();editor=null;host.innerHTML=skeleton('list');host.setAttribute('aria-busy','true');
  try{
   const data=await request(id,{signal:abort.signal});if(!active||!host.isConnected)return;
   const p=data.person,complete=Boolean(p.address&&p.locality&&p.province);
   host.innerHTML=`<h2>Buscar células cercanas</h2><p><strong>${e(p.name)}</strong> · ${p.age==null?'Edad desconocida':e(p.age)+' años'}</p><p>${e([p.address,p.locality,p.province].filter(Boolean).join(', ')||'Sin domicilio registrado')}</p><p role="status">${data.location?'Ubicación confirmada. Las distancias son en línea recta, no de viaje.':complete?'Domicilio sin coordenadas confirmadas. No se pueden calcular distancias.':'Domicilio incompleto. Completalo en la ficha para confirmar su ubicación.'}</p><p class="subtle">Se muestran hasta tres células activas. Se prioriza compatibilidad de edad y luego proximidad conocida. ${p.sex?'':'Sin sexo registrado: la clasificación requiere revisión.'}</p><div class="recommendation-results">${data.items.length?data.items.map(c=>`<article class="recommendation-card"><h3>${e(c.displayCode)}</h3><p>${e(cellGenders[c.gender]||'Clasificación sin información')} · ${e(ageLabel(c))}</p><p>${e(c.locality||'Sin localidad')}</p><p><strong>${e(ageReason(c))}</strong> · ${c.genderCompatibility==='MATCH'?'Clasificación compatible':'Clasificación pendiente de revisión'}</p><p>${c.distanceMeters==null?'Sin distancia calculable':e(distance(c.distanceMeters))+' en línea recta'}</p>${c.canMap?`<a class="button secondary" href="#/territorio/mapa" data-recommendation-map="${e(c.id)}" data-context-navigate>Ver en el mapa</a>`:'<p class="subtle">Ubicación de la célula pendiente de confirmar.</p>'}</article>`).join(''):'<p>No hay células activas compatibles disponibles para esta consulta.</p>'}</div><p class="subtle">Recomendaciones informativas. La derivación desde Matriz está pendiente de integración; consultar no asigna personas ni crea membresías.</p>${data.canEditLocation&&complete?`<details class="recommendation-location"><summary>${data.location?'Revisar ubicación':'Confirmar ubicación de la persona'}</summary><form data-person-location><p>Usá coordenadas conocidas y verificá el punto. Esta herramienta no busca ni envía el domicilio a un servicio de geocodificación.</p>${['address','locality','province'].map(k=>`<input type="hidden" name="${k}" value="${e(p[k]||'')}">`).join('')}<label>País<input name="country" maxlength="100" required value="${e(data.location?.country||'')}"></label><div class="recommendation-coordinates">${['latitude','longitude'].map((k,i)=>`<label>${i?'Longitud':'Latitud'}<input name="${k}" type="number" step="any" min="${i?-180:-85.05112878}" max="${i?180:85.05112878}" required value="${e(data.location?.[k]??'')}"></label>`).join('')}</div>${locationEditorMarkup()}<button type="submit" class="button">Guardar ubicación confirmada</button><p data-location-save-message role="status"></p></form></details>`:''}<button type="button" class="button secondary" data-recommendations-refresh>Actualizar recomendaciones</button>`;
   const form=host.querySelector('[data-person-location]');
   if(form){
    // Reuse preview/drag/confirmation only; personal addresses never enter the geocoder.
    form.querySelector('[data-location-search]').remove();form.querySelector('.location-editor > p').textContent='Podés ajustar el punto manualmente en el mapa. Revisalo antes de confirmar.';
    editor=mountLocationEditor(form,{kind:'person',id});
    form.onsubmit=async ev=>{
     ev.preventDefault();if(saving)return;
     const confirmation=editor.confirmation(),message=form.querySelector('[data-location-save-message]');
     if(!confirmation){message.textContent='Revisá el punto y presioná «Confirmar punto para guardar» antes de guardar.';return;}
     saving=true;const button=form.querySelector('[type="submit"]');button.disabled=true;message.textContent='Guardando…';
     try{await request(id+'/location',{method:'PUT',body:JSON.stringify({latitude:Number(form.elements.latitude.value),longitude:Number(form.elements.longitude.value),country:form.elements.country.value,version:p.version,confirmation}),signal:abort.signal});if(active)await load();}
     catch(error){if(active)message.textContent=error.message;}finally{saving=false;if(button.isConnected)button.disabled=false;}
    };
   }
  }catch(error){if(active&&error.name!=='AbortError')host.innerHTML=`<p role="alert">${e(error.message)}</p><button type="button" class="button secondary" data-recommendations-refresh>Reintentar</button>`;}
  finally{if(active)host.setAttribute('aria-busy','false');release();}
 }
 host.addEventListener('click',event=>{
  if(event.target.closest('[data-recommendations-refresh]')&&!saving)load();
  const link=event.target.closest('[data-recommendation-map]');if(link)try{sessionStorage.setItem('halo-territory-cell',link.dataset.recommendationMap);}catch{}
 },{signal:abort.signal});
 await load();
}
