import {loadPersonDepartmentActivities} from '../departments/controller.js';
import {loadPersonOrganization,canLeaveOrganization} from './organization.js';
import {loadPersonOffice,canLeaveOffice} from './ecclesiastical.js';
import {attendanceContext as attendanceContextView} from '../meetings/monthly-views.js';
import {loadPersonRecommendations} from '../territory/recommendation-panel.js';
import {sessionState} from '../auth/session.js';
import {skeleton} from '../ui/skeleton.js';
import {loadPersonContacts,canLeaveContacts as contactsCanLeave} from '../office-work/contacts.js';
import {loadAccountAction} from '../identity-admin/api.js';
import {loadPersonFollowup} from '../followup/controller.js';
import {loadPersonAttendance} from '../meetings/panels.js';
import {loadPersonCells} from '../cells/person-panel.js';
import {request} from './api.js';
import {profileView,profileBody,historyView,loading,errorView} from './views.js';
import {icon} from '../icons.js';
const canLeaveContacts=()=>canLeaveOrganization()&&canLeaveOffice()&&contactsCanLeave();
let activeDialog=null;
let returnPath=null;
export const personContextReturn=()=>returnPath;
export function closePersonContext() {activeDialog?.close();}
export async function openPersonContext(id,trigger=document.activeElement,attendance=null) {
 if(!canLeaveOrganization()||activeDialog&&!canLeaveContacts())return;closePersonContext();
 returnPath=/^#\/oficina\/(cumpleanos|calidad)$/.test(location.hash)?location.hash.slice(1):null;
 const dialog=document.createElement('dialog');
 dialog.className='person-dialog';
 dialog.setAttribute('aria-label','Ficha contextual de persona');
 dialog.innerHTML=`<header class="context-sheet-header"><span>Consulta rápida · Ficha 360°</span><button class="icon-button" data-close-person aria-label="Cerrar ficha">${icon('close')}</button></header><div class="context-sheet-content">${skeleton('profile')}</div>`;
 document.body.append(dialog);dialog.attendanceContext=attendance?{...attendance,personId:id}:null;activeDialog=dialog;dialog.showModal();
 document.body.classList.add('person-dialog-open');
 dialog.addEventListener('close',()=>{dialog.remove();if(activeDialog===dialog){activeDialog=null;document.body.classList.remove('person-dialog-open');requestAnimationFrame(()=>{if(activeDialog)return;const current=trigger?.isConnected&&trigger.getClientRects().length?trigger:[...document.querySelectorAll(`[data-attendance-open="${CSS.escape(id)}"]`)].find(el=>el.getClientRects().length);current?.focus({preventScroll:true});});}},{once:true});
 dialog.querySelector('[data-close-person]').onclick=()=>{if(canLeaveContacts())dialog.close();};
 dialog.addEventListener('cancel',ev=>{if(!canLeaveContacts())ev.preventDefault();});
 dialog.addEventListener('click',event=>{if(event.target===dialog&&canLeaveContacts())dialog.close();if(event.target.closest('[data-context-navigate]')){if(!canLeaveContacts()){event.preventDefault();return;}dialog.close();}});
 const host=dialog.querySelector('.context-sheet-content');
 async function load() {
  host.innerHTML=skeleton('profile');
  try {
   const person=await request(`/${encodeURIComponent(id)}`);
   if(!dialog.open)return;
   host.innerHTML=profileView(person,{contextual:true});loadAccountAction(host,person);
   if(attendance){host.querySelector('.profile-heading').insertAdjacentHTML('afterend',`<div data-attendance-context>${attendanceContextView(attendance.row,attendance.month)}</div>`);const caps=sessionState.user?.access?.officeWork;if(caps?.trabajar&&caps['contactos.registrar'])host.querySelector('[data-attendance-context]').insertAdjacentHTML('beforeend','<button class="button" data-attendance-register>Registrar contacto</button>');}
   const contactOptions={defaultOrigin:attendance?.row.absent>0?'INASISTENCIA':'CONTACTO_MENSUAL'};
   async function showContacts(register=false){if(!canLeaveContacts())return;host.querySelectorAll('[data-profile-tab]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.profileTab==='officeContacts')));host.querySelector('[data-profile-body]').innerHTML=profileBody(person,'officeContacts');await loadPersonContacts(host,person.id,{...contactOptions,register});}
   async function loadHistory(page=1) {const target=host.querySelector('[data-history-host]');if(!target)return;target.innerHTML=skeleton('list');try {const data=await request(`/${id}/history?page=${page}`);if(target.isConnected)target.innerHTML=historyView(data);}catch(error){if(target.isConnected)target.innerHTML=errorView(error.message);}}
   host.onclick=event=>{
    if(event.target.closest('[data-attendance-register]')){showContacts(true);return;}
    const tab=event.target.closest('[data-profile-tab]');
    if(tab){if(!canLeaveContacts())return;host.querySelectorAll('[data-profile-tab]').forEach(el=>el.setAttribute('aria-pressed',String(el===tab)));host.querySelector('[data-profile-body]').innerHTML=profileBody(person,tab.dataset.profileTab);if(tab.dataset.profileTab==='departmentActivities')loadPersonDepartmentActivities(host,person.id);if(tab.dataset.profileTab==='areas')loadPersonOrganization(host,person.id);if(tab.dataset.profileTab==='ecclesiastical')loadPersonOffice(host,person.id);if(tab.dataset.profileTab==='history')loadHistory();if(tab.dataset.profileTab==='cell')loadPersonCells(host,person.id);if(tab.dataset.profileTab==='recommendations')loadPersonRecommendations(host,person.id);if(tab.dataset.profileTab==='attendance')loadPersonAttendance(host,person.id);if(tab.dataset.profileTab==='officeContacts')loadPersonContacts(host,person.id,contactOptions);if(tab.dataset.profileTab==='followup')loadPersonFollowup(host,person.id);}
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

export function updatePersonAttendanceContext(personId,row,month){const context=activeDialog?.attendanceContext;if(context?.personId!==personId||context.month!==month)return;context.row=row;const host=activeDialog.querySelector('[data-attendance-context] .attendance-context');if(host)host.outerHTML=attendanceContextView(row,month);}
