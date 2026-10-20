import {skeleton} from '../ui/skeleton.js';
import {meetingRequest as api} from './api.js';
import {escape as e} from '../components.js';
import {today} from '../domain/cell.js';
import {weekStart,addDays} from '../domain/meeting.js';
import {meetingRows,matrixView,personRows,dateLabel} from './views.js';
export async function loadPersonAttendance(root,id){const host=root.querySelector('[data-person-attendance]');if(!host)return;
 async function load(page=1){host.innerHTML=skeleton('list');try{const data=await api(`/person/${id}?page=${page}`);if(host.isConnected)host.innerHTML=personRows(data);}catch(err){if(host.isConnected)host.innerHTML=`<p role="alert">${e(err.message)}</p><button class="button secondary" data-attendance-person-page="${page}">Reintentar</button>`;}}
 host.onclick=ev=>{const b=ev.target.closest('[data-attendance-person-page]');if(b)load(Number(b.dataset.attendancePersonPage));};await load();
}
export function mountCellMeetings(host,cellId,matrix=false){let active=true,sequence=0,from=addDays(weekStart(),-21),to=addDays(weekStart(),6),page=1;
 async function load(){const seq=++sequence;host.innerHTML=skeleton('table',{headers:['Persona','Reuniones','Asistencia']});try{
  const query=new URLSearchParams({cellId,from,to,page});let data=await api('?'+query);if(data.capabilities.generar){await api('/generate',{method:'POST',body:JSON.stringify({cellId,from,to})});data=await api('?'+query);}
  const result=matrix?await api(`/matrix/${cellId}?`+new URLSearchParams({from,to,page})):data;
  if(!active||!host.isConnected||seq!==sequence)return;
  host.innerHTML=`<h2>${matrix?'Matriz de asistencia':'Reuniones de la célula'}</h2><div class="meeting-period"><button class="button secondary" data-period="-28">← Cuatro semanas</button><span>${e(dateLabel(from))} al ${e(dateLabel(to))}</span><button class="button secondary" data-period="28" ${addDays(to,28)>addDays(today(),35)?'disabled':''}>Cuatro semanas →</button></div>${data.missingSchedule?'<p class="cell-warning">Falta configurar día u horario. No se inventan reuniones.</p>':''}${matrix?matrixView(result):meetingRows(result)}`;
 }catch(err){if(active&&host.isConnected&&seq===sequence)host.innerHTML=`<p role="alert">${e(err.message)}</p><button class="button secondary" data-retry-meetings>Reintentar</button>`;}}
 const click=ev=>{const period=ev.target.closest('[data-period]'),pagination=ev.target.closest('[data-meeting-page],[data-matrix-page]');if(period){const delta=Number(period.dataset.period);from=addDays(from,delta);to=addDays(to,delta);page=1;load();}if(pagination){page=Number(pagination.dataset.meetingPage||pagination.dataset.matrixPage);load();}if(ev.target.closest('[data-retry-meetings]'))load();};host.addEventListener('click',click);load();return ()=>{active=false;host.removeEventListener('click',click);};
}
