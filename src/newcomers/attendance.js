import {escape as e} from '../components.js';
import {request} from './api.js';
let dirty=false,busy=false,dispose=()=>{};
export const integrationDirty=()=>dirty||busy;
export const canLeaveIntegration=()=>!busy&&(!dirty||confirm('Hay asistencia de Nuevos sin guardar. ¿Descartarla?'));
export function unmountIntegration(){dispose();dispose=()=>{};dirty=false;busy=false;}
window.addEventListener('beforeunload',ev=>{if(integrationDirty()){ev.preventDefault();ev.returnValue='';}});
export async function mountIntegration(root,id,{cellId,onSaved,getMeetingVersion}={}){
 unmountIntegration();let active=true;const abort=new AbortController();dispose=()=>{active=false;abort.abort();};
 const endpoint=cellId?`/api/leader/cells/${cellId}/meetings/${id}/newcomers`:`/api/newcomers/meetings/${id}`;
 const host=document.createElement('section');host.className='cells-panel leader-card newcomer-attendance';root.append(host);
 try{const d=await request('',undefined,endpoint);if(!active||!host.isConnected)return;
  host.innerHTML=`<h2>Nuevos en integración</h2><p>Asistencia independiente de los miembros. Cuenta cuando la reunión está cargada o cerrada.</p><div role="alert" data-new-attendance-error></div><form>${d.items.map(n=>`<article><strong>${e(n.names+' '+n.lastNames)}</strong><p>Célula: ${Math.min(n.attendances,3)}/3</p>${d.editable?`<fieldset><legend class="sr-only">Asistencia de ${e(n.names+' '+n.lastNames)}</legend>${[['PRESENT','Presente'],['ABSENT','Ausente']].map(([v,t])=>`<label><input type="radio" name="${n.id}" value="${v}" ${n.status===v?'checked':''} required> ${t}</label>`).join('')}</fieldset>`:`<p>${d.status==='CANCELLED'?'Reunión cancelada':n.status==='PRESENT'?'Presente':n.status==='ABSENT'?'Ausente':'Sin registrar'}</p>`}</article>`).join('')||'<p>No hay Nuevos derivados para esta reunión.</p>'}${d.editable&&d.items.length?'<button class="button" type="submit">Guardar asistencia de Nuevos</button>':''}</form>`;
  host.addEventListener('change',()=>{dirty=true;},{signal:abort.signal});
  host.addEventListener('submit',async ev=>{ev.preventDefault();ev.stopPropagation();if(busy)return;const error=host.querySelector('[data-new-attendance-error]');if(getMeetingVersion&&getMeetingVersion()!==d.version){error.textContent='La reunión cambió. Recargá antes de continuar.';return;}busy=true;try{const values=new FormData(ev.target);const saved=await request('',{version:d.version,records:d.items.map(n=>({newcomerId:n.id,status:values.get(n.id)}))},endpoint);dirty=false;busy=false;d.version=saved.version;if(active)await onSaved?.(saved);}catch(err){error.textContent=err.message;}finally{busy=false;}},{signal:abort.signal});
 }catch(err){if(active&&host.isConnected){if(err.status===403){host.remove();return;}host.innerHTML=`<h2>Nuevos en integración</h2><p role="alert">${e(err.message)}</p>`;}}
}
