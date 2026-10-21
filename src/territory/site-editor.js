import {escape as e} from '../components.js';
import {locationEditorMarkup,mountLocationEditor,locationRequest} from './location-editor.js';
export function mountSiteEditor(host,{onSaved}){
 let editor,site,active=true,loading=false;const abort=new AbortController();
 host.innerHTML='<details><summary>Configurar sede central</summary><div data-site-content></div></details>';
 host.querySelector('details').addEventListener('toggle',async event=>{
  if(!event.target.open||site||loading)return;loading=true;const content=host.querySelector('[data-site-content]');
  try{site=await locationRequest('/central');if(!active)return;content.innerHTML=`<form data-site-form><div class="form-grid">${[['institution','Institución'],['name','Nombre'],['address','Dirección'],['locality','Localidad'],['province','Provincia'],['country','País'],['latitude','Latitud'],['longitude','Longitud']].map(([k,label])=>`<label>${label}<input name="${k}" value="${e(site[k]??'')}" ${['latitude','longitude'].includes(k)?'type="number" step="any"':'maxlength="200" required'}></label>`).join('')}</div>${locationEditorMarkup()}<button class="button" type="submit">Guardar sede central</button><p data-site-message role="status" aria-live="polite"></p></form>`;editor=mountLocationEditor(content.querySelector('form'),{kind:'central',id:'central'});
  }catch(error){content.textContent=error.message;site=null;}finally{loading=false;}
 },{signal:abort.signal});
 host.addEventListener('submit',async event=>{if(!event.target.matches('[data-site-form]'))return;event.preventDefault();const form=event.target,message=form.querySelector('[data-site-message]'),button=form.querySelector('[type=submit]');button.disabled=true;
  try{const input=Object.fromEntries([...new FormData(form)].filter(([k])=>k!=='locationCandidate'));for(const k of ['latitude','longitude'])input[k]=input[k]===''?null:Number(input[k]);const saved=await locationRequest('/central',{method:'PUT',body:JSON.stringify({...input,version:site.version,confirmation:editor.confirmation()})});if(!active)return;site=saved;message.textContent='Sede guardada.';onSaved(saved);}catch(error){if(active)message.textContent=error.message;}finally{button.disabled=false;}
 },{signal:abort.signal});
 return ()=>{active=false;abort.abort();editor?.destroy();};
}
