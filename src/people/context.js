import {loadAccountAction} from '../identity-admin/api.js';
import {loadPersonFollowup} from '../followup/controller.js';
import {loadPersonAttendance} from '../meetings/panels.js';
import {loadPersonCells} from '../cells/person-panel.js';
import {request} from './api.js';
import {profileView,profileBody,historyView,loading,errorView} from './views.js';
import {icon} from '../icons.js';
let activeDialog=null;
export function closePersonContext() {activeDialog?.close();}
export async function openPersonContext(id,trigger=document.activeElement) {
 closePersonContext();
 const dialog=document.createElement('dialog');
 dialog.className='person-dialog';
 dialog.setAttribute('aria-label','Ficha contextual de persona');
 dialog.innerHTML=`<header class="context-sheet-header"><span>Consulta rápida · Ficha 360°</span><button class="icon-button" data-close-person aria-label="Cerrar ficha">${icon('close')}</button></header><div class="context-sheet-content">${loading}</div>`;
 document.body.append(dialog);activeDialog=dialog;dialog.showModal();
 document.body.classList.add('person-dialog-open');
 dialog.addEventListener('close',()=>{dialog.remove();if(activeDialog===dialog){activeDialog=null;document.body.classList.remove('person-dialog-open');if(trigger?.isConnected)trigger.focus({preventScroll:true});}},{once:true});
 dialog.querySelector('[data-close-person]').onclick=()=>dialog.close();
 dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();if(event.target.closest('[data-context-navigate]'))dialog.close();});
 const host=dialog.querySelector('.context-sheet-content');
 async function load() {
  host.innerHTML=loading;
  try {
   const person=await request(`/${encodeURIComponent(id)}`);
   if(!dialog.open)return;
   host.innerHTML=profileView(person,{contextual:true});loadAccountAction(host,person);
   async function loadHistory(page=1) {const target=host.querySelector('[data-history-host]');if(!target)return;target.innerHTML=loading;try {const data=await request(`/${id}/history?page=${page}`);if(target.isConnected)target.innerHTML=historyView(data);}catch(error){if(target.isConnected)target.innerHTML=errorView(error.message);}}
   host.onclick=event=>{
    const tab=event.target.closest('[data-profile-tab]');
    if(tab){host.querySelectorAll('[data-profile-tab]').forEach(el=>el.setAttribute('aria-pressed',String(el===tab)));host.querySelector('[data-profile-body]').innerHTML=profileBody(person,tab.dataset.profileTab);if(tab.dataset.profileTab==='history')loadHistory();if(tab.dataset.profileTab==='cell')loadPersonCells(host,person.id);if(tab.dataset.profileTab==='attendance')loadPersonAttendance(host,person.id);if(tab.dataset.profileTab==='followup')loadPersonFollowup(host,person.id);}
    const page=event.target.closest('[data-history-page]');if(page)loadHistory(page.dataset.historyPage);
    if(event.target.closest('[data-people-action="retry"]'))loadHistory();
   };
  }catch(error){if(dialog.open){host.innerHTML=errorView(error.message);host.querySelector('button').onclick=load;}}
 }
 await load();
}
export function installPersonContext() {
 document.addEventListener('click',event=>{
  const link=event.target.closest('[data-person-id]');
  if(!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button!==0)return;
  event.preventDefault();openPersonContext(link.dataset.personId,link);
 });
}
