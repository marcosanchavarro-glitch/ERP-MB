import {request} from './api.js';
import {escape as e,pageTitle} from '../components.js';
import {skeleton,holdLayout} from '../ui/skeleton.js';
let editor=null;const loads=new WeakMap();
export function canLeaveOffice(){if(!editor?.host.isConnected)return true;if(editor.busy)return false;if(editor.dirty&&!window.confirm('Hay cambios de cargo sin guardar. ¿Querés descartarlos?'))return false;editor.dirty=false;return true;}
window.addEventListener('beforeunload',event=>{if(editor?.host.isConnected&&(editor.dirty||editor.busy)){event.preventDefault();event.returnValue='';}});
export async function loadPersonOffice(root,id,page=1){
 const host=root.querySelector('[data-person-office]');if(!host)return;const token=Symbol();loads.set(host,token);const release=holdLayout(host);host.innerHTML=skeleton('list');
 try{
  const data=await request(`/${id}/ecclesiastical-office?page=${page}`);if(!host.isConnected||loads.get(host)!==token)return;
  host.innerHTML=`<h2>Cargo eclesiástico</h2>${data.current?`<p><span class="ecclesiastical-badge">${e(data.current.name)}</span> · Desde ${e(data.current.startDate)}</p>`:'<p>Sin cargo registrado.</p>'}${data.canManage?'<button type="button" class="button secondary" data-office-edit>Modificar cargo</button>':''}<div data-office-form></div><p role="status" data-office-message></p>${data.history?`<h3>Historial de cargos</h3><div class="office-history">${data.history.items.map(a=>`<article><p><strong>${e(a.previousName||'Sin cargo registrado')} → ${e(a.name)}</strong></p><p>Desde ${e(a.startDate)}${a.endDate?' · Hasta el cambio del '+e(a.endDate):' · Vigente'}</p><p>Registrado por ${e(a.actor)} · ${e(new Date(a.recordedAt).toLocaleString('es-AR'))}</p>${a.reason?`<p>${e(a.reason)}</p>`:''}</article>`).join('')||'<p>No hay cambios registrados.</p>'}</div><div class="people-pagination"><span>Página ${data.history.page} de ${data.history.pages}</span><button type="button" class="button secondary" data-office-page="${data.history.page-1}" ${data.history.page===1?'disabled':''}>Anterior</button><button type="button" class="button secondary" data-office-page="${data.history.page+1}" ${data.history.page===data.history.pages?'disabled':''}>Siguiente</button></div>`:''}<p class="subtle">Los cambios conservan el historial institucional.</p>`;
  const state={host,dirty:false,busy:false};editor=state;
  host.onclick=event=>{
   const button=event.target.closest('button');if(!button)return;
   if(button.hasAttribute('data-office-page')&&canLeaveOffice())loadPersonOffice(root,id,Number(button.dataset.officePage));
   if(button.hasAttribute('data-office-cancel')&&canLeaveOffice())host.querySelector('[data-office-form]').replaceChildren();
   if(button.hasAttribute('data-office-edit')){if(state.busy||!canLeaveOffice())return;host.querySelector('[data-office-message]').textContent='';
    host.querySelector('[data-office-form]').innerHTML=`<form class="office-appointment-form"><h3>Modificar cargo</h3><label>Nuevo cargo<select name="officeId" aria-label="Nuevo cargo" required>${data.offices.filter(o=>o.active).map(o=>`<option value="${e(o.id)}" ${(data.current?.officeId===o.id||!data.current&&o.id==='MEMBER')?'selected':''}>${e(o.name)}</option>`).join('')}</select></label><label>Fecha efectiva<input type="date" name="effectiveDate" min="${e(data.current?.startDate||'1800-01-01')}" required></label><label>Motivo u observación (opcional)<textarea name="reason" maxlength="1000"></textarea></label><label><input name="confirmed" type="checkbox" required> Confirmo la incorporación formal de la persona y el cambio de cargo indicado.</label><div class="form-actions"><button type="submit" class="button">Confirmar y guardar cargo</button><button type="button" class="button secondary" data-office-cancel>Cancelar</button></div><p role="alert" data-office-error></p></form>`;
    const form=host.querySelector('form');form.oninput=()=>{state.dirty=true;};let operationId=crypto.randomUUID(),attempt=null;
    form.onsubmit=async event=>{
     event.preventDefault();if(state.busy)return;const values={officeId:form.elements.officeId.value,effectiveDate:form.elements.effectiveDate.value,reason:form.elements.reason.value,expectedId:data.current?.id||null,confirmed:form.elements.confirmed.checked};
     const serialized=JSON.stringify(values);if(attempt!==null&&attempt!==serialized)operationId=crypto.randomUUID();attempt=serialized;state.busy=true;const controls=[...form.querySelectorAll('input,select,textarea,button')];controls.forEach(c=>c.disabled=true);form.querySelector('[data-office-error]').textContent='Guardando…';
     try{await request(`/${id}/ecclesiastical-office`,{method:'POST',body:JSON.stringify({...values,operationId})});state.dirty=false;state.busy=false;if(host.isConnected){await loadPersonOffice(root,id);host.querySelector('[data-office-message]').textContent='Cargo guardado.';}}
     catch(error){if(form.isConnected)form.querySelector('[data-office-error]').textContent=error.message;}
     finally{state.busy=false;controls.forEach(c=>c.disabled=false);}
    };
   }
  };
 }catch(error){if(host.isConnected&&loads.get(host)===token){host.innerHTML=`<h2>Cargo eclesiástico</h2><p role="alert">${e(error.message)}</p><button type="button" class="button secondary">Reintentar</button>`;host.querySelector('button').onclick=()=>loadPersonOffice(root,id,page);}}
 finally{release();}
}
export async function mountOfficeCatalog(root){
 root.innerHTML=skeleton('list');
 try{const data=await request('/ecclesiastical-offices');if(!root.isConnected)return;root.innerHTML=`${pageTitle('OFICINA · DATOS FUNDAMENTALES','Cargos eclesiásticos','Consultá la jerarquía oficial y los cargos vigentes registrados.')}<section class="profile-section"><p>La jerarquía describe la organización institucional de Manantial de Bendiciones.</p>${data.limited?'<p>Las cifras incluyen únicamente personas que podés consultar.</p>':''}<ol class="office-catalog">${data.items.map(o=>`<li><strong>${e(o.name)}</strong><span>${o.count} ${o.count===1?'persona':'personas'} con cargo vigente registrado</span></li>`).join('')}</ol><p>Las fichas sin cargo registrado no se cuentan automáticamente como Miembro. Los cargos oficiales y su orden se mantienen estables.</p><p>Las diferencias entre cargo y liderazgo celular requieren revisión administrativa; esta consulta no cambia asignaciones.</p></section>`;}
 catch(error){if(root.isConnected){root.innerHTML=`<h1>Cargos eclesiásticos</h1><p role="alert">${e(error.message)}</p><button type="button" class="button">Reintentar</button>`;root.querySelector('button').onclick=()=>mountOfficeCatalog(root);}}
}
