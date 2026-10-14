import {sessionState} from '../auth/session.js';
import {escape as e} from '../components.js';
import {request} from './api.js';
import {blankPerson,validatePerson,sexes,fullName} from '../domain/person.js';
import {personLink} from './views.js';
// Reusable real Person creation, in a dialog or inline in another domain.
export function mountQuickPerson(host,{initialName='',onCreated=()=>{},onCancel=()=>{},onDirty=()=>{},onSaving=()=>{}}={}){
 let alive=true,saving=false,dirty=false;const abort=new AbortController();
 const parts=initialName.trim().split(/\s+/).filter(Boolean),initial={names:parts.shift()||'',lastNames:parts.join(' ')};
 host.innerHTML=`<form class="quick-person-form"><h2>Alta rápida de persona</h2><p class="subtle">Nombre y apellido son obligatorios. Podés completar la ficha después.</p><div class="quick-feedback" role="alert"></div><div class="form-grid">${[['names','Nombres',true],['lastNames','Apellidos',true]].map(([key,label,required])=>`<label class="form-field">${label} *<input name="${key}" value="${e(initial[key])}" required maxlength="100" autocomplete="off"></label>`).join('')}<label class="form-field">Sexo<select name="sex" aria-label="Sexo"><option value="" selected disabled hidden>Seleccionar sexo</option>${Object.entries(sexes).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label class="form-field">Celular<input name="phone" type="tel" maxlength="30"></label><label class="form-field">Documento<input name="document" maxlength="30"></label></div><div class="form-actions"><button type="button" class="button secondary" data-quick-cancel>Cancelar</button><button class="button" type="submit">Crear persona</button></div></form>`;
 const form=host.querySelector('form'),feedback=host.querySelector('.quick-feedback');
 const cancel=()=>{if(!saving&&(!dirty||window.confirm('¿Descartar los datos del alta rápida?')))onCancel();};
 form.addEventListener('input',ev=>{if(ev.target.name==='acknowledge')return;dirty=true;onDirty(true);const ack=host.querySelector('[name=acknowledge]');if(ack)ack.checked=false;},{signal:abort.signal});
 host.querySelector('[data-quick-cancel]').onclick=cancel;
 form.addEventListener('submit',async ev=>{ev.preventDefault();ev.stopPropagation();if(saving)return;const data=Object.fromEntries(new FormData(form)),input={...blankPerson(),names:data.names,lastNames:data.lastNames,sex:data.sex||'',phone:data.phone,document:data.document};const validation=validatePerson(input);if(Object.keys(validation.errors).length){feedback.textContent=Object.values(validation.errors).join(' ');return;}
  const acknowledgeDuplicates=Boolean(host.querySelector('[name=acknowledge]')?.checked);saving=true;onSaving(true);const controls=[...form.querySelectorAll('input,select,button')];controls.forEach(c=>c.disabled=true);
  try{const person=await request('',{method:'POST',body:JSON.stringify({person:input,acknowledgeDuplicates})});dirty=false;onDirty(false);if(alive)await onCreated(person);}
  catch(err){if(alive)feedback.innerHTML=`${e(err.message)}${err.matches?`<ul>${err.matches.map(m=>`<li>${personLink(m)}</li>`).join('')}</ul><label class="duplicate-confirm"><input type="checkbox" name="acknowledge"> Revisé las coincidencias y se trata de otra persona.</label>`:''}`;}
  finally{saving=false;onSaving(false);controls.forEach(c=>c.disabled=false);}
 },{signal:abort.signal});
 form.querySelector('input').focus({preventScroll:true});
 return {cancel,get dirty(){return dirty;},get saving(){return saving;},destroy(){alive=false;abort.abort();}};
}

let current=null;
export function canLeaveQuick(){return !current||current.canLeave();}
export function closeQuickPerson(){current?.dispose();}
export async function openQuickPerson({onCreated=()=>{}}={}){
 const meta=await request('/meta');if(!meta.capabilities.create)throw new Error('No tenés permiso para crear personas.');
 closeQuickPerson();const previousUser=sessionState.user?.id,dialog=document.createElement('dialog');let paused=false,disposed=false;
 dialog.className='quick-person-dialog';dialog.setAttribute('aria-label','Alta rápida de persona');document.body.append(dialog);dialog.showModal();
 const quick=mountQuickPerson(dialog,{onCancel:()=>dialog.close(),onCreated:async person=>{await onCreated(person);dialog.close();}});
 dialog.addEventListener('cancel',ev=>{ev.preventDefault();quick.cancel();});
 const expire=()=>{if(dialog.open){paused=true;dialog.close();dialog.hidden=true;}};
 const observer=new MutationObserver(()=>{if(paused&&!document.querySelector('#app')?.hidden){if(sessionState.user?.id!==previousUser){dispose();return;}paused=false;dialog.hidden=false;dialog.showModal();}});
 observer.observe(document.querySelector('#app'),{attributes:true,attributeFilter:['hidden']});window.addEventListener('session-expired',expire);
 const unload=ev=>{if(quick.dirty||quick.saving){ev.preventDefault();ev.returnValue='';}};window.addEventListener('beforeunload',unload);
 function dispose(){if(disposed)return;disposed=true;quick.destroy();observer.disconnect();window.removeEventListener('session-expired',expire);window.removeEventListener('beforeunload',unload);dialog.remove();if(current?.dialog===dialog)current=null;}
 current={dialog,dispose,canLeave:()=>!quick.saving&&(!quick.dirty||window.confirm('¿Descartar los datos del alta rápida?'))};dialog.addEventListener('close',()=>{if(!paused)dispose();});
}
