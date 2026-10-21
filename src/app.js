import {territoryRoute,mountTerritory,unmountTerritory} from './territory/controller.js';
import {canLeaveContacts} from './office-work/contacts.js';
import {workRoute,mountWork,unmountWork,canLeaveWork} from './office-work/controller.js';
import {importRoute,mountImport,unmountImport,canLeaveImport} from './imports/controller.js';
import {appointmentsRoute,mountAppointments,unmountAppointments,canLeaveAppointments} from './appointments/controller.js';
import {newcomersRoute,mountNewcomers,unmountNewcomers,canLeaveNewcomers} from './newcomers/controller.js';
import {canLeaveIntegration,unmountIntegration} from './newcomers/attendance.js';
import {themeContext} from './theme-control.js';
import {officeRoute,mountOffice,unmountOffice} from './office/controller.js';
import {loadIdentity} from './branding.js';
import {adminRoute,mountAdmin,unmountAdmin,canLeaveAdmin} from './identity-admin/controller.js';
import {followupRoute,mountFollowup,unmountFollowup,canLeaveFollowup} from './followup/controller.js';
import {leaderRoute,mountLeader,unmountLeader,canLeaveLeader} from './leader/controller.js';
import {node as leaderNode} from './leader/views.js';
import {navigation} from './config.js';
import {meetingsRoute,mountMeetings,unmountMeetings,canLeaveMeetings} from './meetings/controller.js';
import {closeQuickPerson,canLeaveQuick} from './people/quick.js';
import {cellsRoute,mountCells,unmountCells,canLeaveCells} from './cells/controller.js';
import {installCellContext,closeCellContext} from './cells/person-panel.js';
import {sessionState,refreshSession} from './auth/session.js';
import {showLogin,logout} from './auth/ui.js';
import {identity, resolveRoute} from './config.js';
import {escape as escapeBrand,sidebar, topbar, home, placeholder, pageTitle, buttonLink} from './components.js';
import {peopleRoute,mountPeople,unmountPeople,canLeavePeople} from './people/controller.js';
import {installPersonContext,closePersonContext} from './people/context.js';
try{await loadIdentity();}catch(error){document.querySelector('#app').textContent='No pudimos cargar la configuración. Recargá la página para reintentar.';throw error;}
let expanded = null, collapsed = false, mobileOpen = false, sidebarKey = null;
const app = document.querySelector('#app');
document.querySelector('.skip-link')?.addEventListener('click',event=>{event.preventDefault();document.querySelector('#main')?.focus();});
const mobile = () => matchMedia('(max-width: 760px)').matches;
// Visual accent is resolved by semantic theme tokens.
function permittedOther(path){path=path.split('?')[0];const paths=sessionState.user?.access?.paths||[];return paths.some(p=>path===p.path||path.startsWith(p.path+'/')&&!navigation.some(area=>area.path===p.path)||p.path.startsWith(path+'/'));}
function visibleNavigation(){const portal=sessionState.user?.access?.leaderPortal?[leaderNode]:[];return [...portal,...navigation.filter(n=>n.path==='/').concat(navigation.filter(n=>n.path!=='/').map(n=>({...n,children:n.children.filter(c=>permittedOther(c.path))})).filter(n=>permittedOther(n.path)||n.children.length))];}
// Keep scroll containers and focused controls alive during local shell updates.
function updateSidebar(route){
 const aside=app.querySelector('.sidebar'),modules=visibleNavigation(),key=JSON.stringify(modules);
 if(key!==sidebarKey){aside.innerHTML=sidebar(route,expanded,modules);sidebarKey=key;}
 for(const button of aside.querySelectorAll('[data-expand]')){
  const open=button.dataset.expand===expanded;button.setAttribute('aria-expanded',String(open));
  aside.querySelector('#'+button.getAttribute('aria-controls')).hidden=!open;
 }
 for(const row of aside.querySelectorAll('.nav-row'))row.classList.toggle('selected',row.querySelector('a').getAttribute('href')==='#'+route?.area.path);
 for(const link of aside.querySelectorAll('nav a')){
  if(link.getAttribute('href')==='#'+route?.section.path)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
 }
}
function afterLogin(){
 const path=location.hash.slice(1)||'/';
 if(sessionState.user.access?.leaderPortal&&!leaderRoute(path)&&!permittedOther(path)&&!(path==='/'&&sessionState.user.access.portalLanding===false)){
  history.replaceState(null,'',location.pathname+location.search+'#/mi-celula');previousHash=location.hash;
 }else if(!sessionState.user.access?.leaderPortal&&leaderRoute(path)){
  history.replaceState(null,'',location.pathname+location.search+'#/');previousHash=location.hash;
 }
 render(true);
}
function render(moveFocus = false,refreshContent = true) {
 if(!sessionState.user)return;
 if(!history.state?.haloEntry)history.replaceState({...history.state,haloEntry:crypto.randomUUID()},'');
 let path=location.hash.slice(1) || '/';
 if(sessionState.user.access?.leaderPortal&&sessionState.user.access?.portalLanding!==false&&path==='/'){path='/mi-celula';history.replaceState(null,'',location.pathname+location.search+'#'+path);previousHash=location.hash;}
 const leader=leaderRoute(path);
 const leaderContext=Boolean(leader||(sessionState.user.access?.leaderPortal&&path!=='/'&&!permittedOther(path)));
 const work=workRoute(path);
 const matrixImport=importRoute(path);
 const citaRoute=appointmentsRoute(path);
 const newRoute=newcomersRoute(path);
 const insightRoute=officeRoute(path);
 const identityRoute=adminRoute(path);
 const allowed=path==='/'||permittedOther(path.split('?')[0]);
 const followRoute=followupRoute(path);
 const personRoute=peopleRoute(path);
 const cellRoute=cellsRoute(path);
 const meetingRoute=meetingsRoute(path);
 const route = leaderContext?{area:leaderNode,section:leaderNode}:resolveRoute(work?(work.kind==='monthly'?'/oficina/asistencia':'/oficina/trabajo'):matrixImport?'/oficina/importar-exportar':citaRoute?'/oficina/citas':newRoute?(newRoute.kind==='reception'?'/recepcion':'/oficina/nuevos'):insightRoute?('/oficina/'+({birthdays:'cumpleanos',quality:'calidad',dashboard:'dashboard'}[insightRoute])):identityRoute?(identityRoute.kind==='roles'?'/administracion/roles':identityRoute.kind==='audit'?'/administracion/auditoria':'/administracion/usuarios'):followRoute?'/oficina/seguimiento':personRoute?'/oficina/personas':cellRoute?'/oficina/celulas':meetingRoute?'/oficina/asistencia':path);
 themeContext(route?.area.id,route?.section!==route?.area?route?.section.id:'');
 if(!refreshContent && app.querySelector('.shell')) {
  app.querySelector('.shell').className=`shell ${leaderContext?'leader-shell':''} ${collapsed?'is-collapsed':''} ${mobileOpen?'nav-open':''}`;
  updateSidebar(route);
  app.querySelector('.sidebar').inert=mobile()&&!mobileOpen;
  app.querySelector('.workspace').inert=mobile()&&mobileOpen;
  document.body.classList.toggle('menu-open',mobile()&&mobileOpen);
  app.querySelector('[data-action="toggle-nav"]').setAttribute('aria-expanded',String(mobile()?mobileOpen:!collapsed));
  return;
 }
 unmountTerritory();unmountWork();unmountImport();unmountAppointments();unmountNewcomers();unmountIntegration();unmountOffice();unmountAdmin();unmountFollowup();unmountPeople();unmountCells();unmountMeetings();unmountLeader();
 const initialContent=leaderContext?'':route ? route.section.path==='/'?home(visibleNavigation(),sessionState.user):placeholder({...route,area:{...route.area,children:route.area.children.filter(c=>permittedOther(c.path))},section:route.section===route.area?{...route.section,children:route.section.children.filter(c=>permittedOther(c.path))}:route.section}):`${pageTitle('Navegación','No encontramos esta sección.','Podés volver al inicio y explorar las áreas del ERP.')}${buttonLink('/','Volver al inicio')}`;
 if(app.querySelector('.shell')?.dataset.sessionUser===sessionState.user.id){
  render(false,false);app.querySelector('.topbar').innerHTML=topbar(route,sessionState.user);const previousMain=app.querySelector('#main'),nextMain=previousMain.cloneNode(false);nextMain.style.removeProperty('min-height');previousMain.replaceWith(nextMain);nextMain.innerHTML=initialContent;
 }else{
 app.innerHTML = `<div class="shell ${leaderContext?'leader-shell':''} ${collapsed?'is-collapsed':''} ${mobileOpen?'nav-open':''}"><button class="backdrop" tabindex="-1" data-action="close" aria-label="Cerrar navegación"></button><aside class="sidebar" ${mobile()&&!mobileOpen?'inert':''}>${sidebar(route,expanded,visibleNavigation())}</aside><div class="workspace" ${mobile()&&mobileOpen?'inert':''}><header class="topbar">${topbar(route,sessionState.user)}</header><main id="main" tabindex="-1" class="content">${initialContent}</main><footer><span>${escapeBrand(identity.productName)} <span class="footer-dot">·</span> ${escapeBrand(identity.organizationName)}</span><span>Unidos para servir.</span></footer></div></div>`;
 }
 sidebarKey=JSON.stringify(visibleNavigation());
 app.querySelector('.shell').dataset.sessionUser=sessionState.user.id;
 const toggle = document.querySelector('[data-action="toggle-nav"]');
 toggle.setAttribute('aria-expanded', String(mobile() ? mobileOpen : !collapsed));
 toggle.setAttribute('aria-controls', 'primary-sidebar');
 document.querySelector('.sidebar').id = 'primary-sidebar';
 const main=document.querySelector('#main');
 main.className=leaderContext?'content leader-main':'content';
 if(leaderContext){if(leader)mountLeader(main,leader);else main.innerHTML='<h1>Acceso no disponible</h1><p>Esta sección no está disponible.</p><a class="button" href="#/mi-celula">Volver a Mi Célula</a>';}
 else if(!allowed)main.innerHTML='<h1>Acceso no disponible</h1><p>Esta sección no está disponible.</p>';
 else if(path==='/'&&main.querySelector('[data-home-work]'))mountOffice(main.querySelector('[data-home-work]'),'home',{omitPaths:[...main.querySelectorAll('.halo-portal')].map(a=>a.getAttribute('href').slice(1))});
 else if(territoryRoute(path))mountTerritory(main);
 else if(work)mountWork(main,work);
 else if(path==='/oficina'&&sessionState.user.access?.officeWork?.['contactos.ver'])mountWork(main,{kind:'personal',search:''});
 else if(matrixImport)mountImport(main,matrixImport);
 else if(citaRoute)mountAppointments(main,citaRoute);
 else if(newRoute)mountNewcomers(main,newRoute);
 else if(insightRoute)mountOffice(main,insightRoute);
 else if(identityRoute)mountAdmin(main,identityRoute);
 else if(followRoute)mountFollowup(main,followRoute);
 else if(personRoute)mountPeople(main,personRoute);
 else if(cellRoute)mountCells(main,cellRoute);
 else if(meetingRoute)mountMeetings(main,meetingRoute);
 else if(route?.section.id==='oficina')main.innerHTML=`${pageTitle('MI TRABAJO','Oficina Manantial','Elegí una herramienta desde el menú de navegación.')}`;
 document.title = `${route?.section.name || 'Sección no encontrada'} · ${identity.productName}`;
 document.body.classList.toggle('menu-open', mobile() && mobileOpen);
 if(moveFocus) document.querySelector('#main').focus({preventScroll:true});
}
app.addEventListener('click', event => {
 const expand = event.target.closest('[data-expand]');
 if(expand) {expanded = expanded===expand.dataset.expand?null:expand.dataset.expand; collapsed=false; render(false,false); document.querySelector(`[data-expand="${expand.dataset.expand}"]`).focus({preventScroll:true}); return;}
 const action = event.target.closest('[data-action]')?.dataset.action;
 if(action==='logout'){if(canLeaveContacts()&&canLeaveWork()&&canLeaveImport()&&canLeaveAppointments()&&canLeaveNewcomers()&&canLeaveIntegration()&&canLeaveAdmin()&&canLeaveFollowup()&&canLeavePeople()&&canLeaveCells()&&canLeaveMeetings()&&canLeaveLeader()&&canLeaveQuick())logout().then(()=>{unmountTerritory();unmountWork();unmountImport();unmountAppointments();unmountNewcomers();unmountIntegration();unmountOffice();unmountAdmin();unmountFollowup();unmountPeople();unmountCells();unmountMeetings();unmountLeader();closeQuickPerson();closePersonContext();closeCellContext();app.innerHTML='';showLogin(afterLogin);}).catch(error=>window.alert(error.message));return;}
 if(action==='toggle-nav') {if(mobile()) mobileOpen=!mobileOpen; else collapsed=!collapsed; render(false,false); document.querySelector(mobile()?'.sidebar .brand':'[data-action="toggle-nav"]').focus({preventScroll:true});}
 if(action==='close') closeMenu();
 if(event.target.closest('a[href^="#/"]') && mobileOpen) {mobileOpen=false; render(false,false);}
});
function closeMenu() {mobileOpen=false; render(false,false); document.querySelector('[data-action="toggle-nav"]').focus({preventScroll:true});}
document.addEventListener('keydown',event=>{
 if(!mobileOpen || !mobile()) return;
 if(event.key==='Escape') closeMenu();
 if(event.key==='Tab') {
  const items=[...document.querySelectorAll('.sidebar a, .sidebar button')].filter(el=>el.getClientRects().length);
  const first=items[0], last=items.at(-1);
  if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
 }
});
let previousHash=location.hash;
window.addEventListener('hashchange',()=>{
 if(!canLeaveContacts()||!canLeaveWork()||!canLeaveImport()||!canLeaveAppointments()||!canLeaveNewcomers()||!canLeaveIntegration()||!canLeaveAdmin()||!canLeaveFollowup()||!canLeavePeople()||!canLeaveCells()||!canLeaveMeetings()||!canLeaveLeader()||!canLeaveQuick()){history.replaceState(null,'',`${location.pathname}${location.search}${previousHash}`);return;}
 const traversal=Boolean(history.state?.haloEntry);
 previousHash=location.hash;closeQuickPerson();closePersonContext();closeCellContext();
 const path=location.hash.slice(1),route=resolveRoute(peopleRoute(path)?'/oficina/personas':cellsRoute(path)?'/oficina/celulas':meetingsRoute(path)?'/oficina/asistencia':path);
 expanded=route?.area.children.length?route.area.id:null;mobileOpen=false;render(!traversal);if(!traversal)window.scrollTo(0,0);
});
matchMedia('(max-width: 760px)').addEventListener('change',()=>{mobileOpen=false;render(false,false);});
expanded=resolveRoute(peopleRoute(location.hash.slice(1))?'/oficina/personas':cellsRoute(location.hash.slice(1))?'/oficina/celulas':meetingsRoute(location.hash.slice(1))?'/oficina/asistencia':location.hash.slice(1))?.area.id || null;
installPersonContext();installCellContext();
window.addEventListener('session-expired',()=>{
 const previousUser=sessionState.user?.id,previousPortal=sessionState.user?.access?.leaderPortal,previousAccess=JSON.stringify(sessionState.user?.access);closePersonContext();closeCellContext();
 showLogin(()=>{if(sessionState.user.id!==previousUser||sessionState.user.access?.leaderPortal!==previousPortal||JSON.stringify(sessionState.user.access)!==previousAccess||app.querySelector('[data-account-reload]'))afterLogin();else if(!app.querySelector('.shell,.leader-shell'))render(true);},{expired:true});
});
try {const state=await refreshSession();if(state.authenticated)render();else showLogin(afterLogin);}
catch {showLogin(()=>render(true),{expired:true});}
