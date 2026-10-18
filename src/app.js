import {newcomersRoute,mountNewcomers,unmountNewcomers,canLeaveNewcomers} from './newcomers/controller.js';
import {canLeaveIntegration,unmountIntegration} from './newcomers/attendance.js';
import {themeContext} from './theme-control.js';
import {officeRoute,mountOffice,unmountOffice} from './office/controller.js';
import {loadIdentity} from './branding.js';
import {adminRoute,mountAdmin,unmountAdmin,canLeaveAdmin} from './identity-admin/controller.js';
import {followupRoute,mountFollowup,unmountFollowup,canLeaveFollowup} from './followup/controller.js';
import {leaderRoute,mountLeader,unmountLeader,canLeaveLeader} from './leader/controller.js';
import {shell as leaderShell,node as leaderNode} from './leader/views.js';
import {navigation} from './config.js';
import {meetingsRoute,mountMeetings,unmountMeetings,canLeaveMeetings} from './meetings/controller.js';
import {closeQuickPerson,canLeaveQuick} from './people/quick.js';
import {cellsRoute,mountCells,unmountCells,canLeaveCells} from './cells/controller.js';
import {installCellContext,closeCellContext} from './cells/person-panel.js';
import {sessionState,refreshSession} from './auth/session.js';
import {showLogin,logout} from './auth/ui.js';
import {identity, resolveRoute} from './config.js';
import {escape as escapeBrand,sidebar, topbar, home, placeholder, pageTitle, buttonLink, officeLanding} from './components.js';
import {peopleRoute,mountPeople,unmountPeople,canLeavePeople} from './people/controller.js';
import {installPersonContext,closePersonContext} from './people/context.js';
try{await loadIdentity();}catch(error){document.querySelector('#app').textContent='No pudimos cargar la configuración. Recargá la página para reintentar.';throw error;}
let expanded = null, collapsed = false, mobileOpen = false;
const app = document.querySelector('#app');
const mobile = () => matchMedia('(max-width: 760px)').matches;
// Visual accent is resolved by semantic theme tokens.
function permittedOther(path){path=path.split('?')[0];const paths=sessionState.user?.access?.paths||[];return Boolean(sessionState.user?.access?.allModules)||paths.some(p=>path===p.path||path.startsWith(p.path+'/')||p.path.startsWith(path+'/'));}
function visibleNavigation(){const portal=sessionState.user?.access?.leaderPortal?[leaderNode]:[];if(sessionState.user?.access?.allModules)return [...portal,...navigation];return [...portal,...navigation.filter(n=>n.path==='/').concat(navigation.filter(n=>n.path!=='/').map(n=>({...n,children:n.children.filter(c=>permittedOther(c.path))})).filter(n=>permittedOther(n.path)||n.children.length))];}
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
 let path=location.hash.slice(1) || '/';
 if(sessionState.user.access?.leaderPortal&&sessionState.user.access?.portalLanding!==false&&path==='/'){path='/mi-celula';history.replaceState(null,'',location.pathname+location.search+'#'+path);previousHash=location.hash;}
 const leader=leaderRoute(path);
 if(leader||(sessionState.user.access?.leaderPortal&&path!=='/'&&!permittedOther(path))){
  if(!refreshContent&&app.querySelector('.leader-shell'))return;
  unmountNewcomers();unmountIntegration();unmountOffice();unmountAdmin();unmountFollowup();unmountPeople();unmountCells();unmountMeetings();unmountLeader();closePersonContext();closeCellContext();
  themeContext(leaderNode.id);app.innerHTML=leaderShell(sessionState.user);mobileOpen=false;document.body.classList.remove('menu-open');
  const main=app.querySelector('#main');
  if(leader)mountLeader(main,leader);else main.innerHTML='<h1>Acceso no disponible</h1><p>Esta sección no está entre tus accesos autorizados.</p><a class="button" href="#/mi-celula">Volver a Mi Célula</a>';
  document.title='Mi Célula · '+identity.productName;if(moveFocus)main.focus();return;
 }
 const newRoute=newcomersRoute(path);
 const insightRoute=officeRoute(path);
 const identityRoute=adminRoute(path);
 const allowed=path==='/'||permittedOther(path.split('?')[0]);
 const followRoute=followupRoute(path);
 const personRoute=peopleRoute(path);
 const cellRoute=cellsRoute(path);
 const meetingRoute=meetingsRoute(path);
 const route = resolveRoute(newRoute?(newRoute.kind==='reception'?'/recepcion':'/oficina/nuevos'):insightRoute?('/oficina/'+({birthdays:'cumpleanos',quality:'calidad',dashboard:'dashboard'}[insightRoute])):identityRoute?(identityRoute.kind==='roles'?'/administracion/roles':identityRoute.kind==='audit'?'/administracion/auditoria':'/administracion/usuarios'):followRoute?'/oficina/seguimiento':personRoute?'/oficina/personas':cellRoute?'/oficina/celulas':meetingRoute?'/oficina/asistencia':path);
 themeContext(route?.area.id,route?.section!==route?.area?route?.section.id:'');
 if(!refreshContent && app.querySelector('.shell')) {
  app.querySelector('.shell').className=`shell ${collapsed?'is-collapsed':''} ${mobileOpen?'nav-open':''}`;
  app.querySelector('.sidebar').innerHTML=sidebar(route,expanded,visibleNavigation());
  app.querySelector('.sidebar').inert=mobile()&&!mobileOpen;
  app.querySelector('.workspace').inert=mobile()&&mobileOpen;
  document.body.classList.toggle('menu-open',mobile()&&mobileOpen);
  app.querySelector('[data-action="toggle-nav"]').setAttribute('aria-expanded',String(mobile()?mobileOpen:!collapsed));
  return;
 }
 unmountNewcomers();unmountIntegration();unmountOffice();unmountAdmin();unmountFollowup();unmountPeople();unmountCells();unmountMeetings();unmountLeader();
 app.innerHTML = `<div class="shell ${collapsed?'is-collapsed':''} ${mobileOpen?'nav-open':''}"><button class="backdrop" tabindex="-1" data-action="close" aria-label="Cerrar navegación"></button><aside class="sidebar" ${mobile()&&!mobileOpen?'inert':''}>${sidebar(route,expanded,visibleNavigation())}</aside><div class="workspace" ${mobile()&&mobileOpen?'inert':''}><header class="topbar">${topbar(route,sessionState.user)}</header><main id="main" tabindex="-1" class="content">${route ? route.section.path==='/'?home(visibleNavigation()):placeholder({...route,area:{...route.area,children:route.area.children.filter(c=>permittedOther(c.path))},section:route.section===route.area?{...route.section,children:route.section.children.filter(c=>permittedOther(c.path))}:route.section}):`${pageTitle('Navegación','No encontramos esta sección.','Podés volver al inicio y explorar las áreas del ERP.')}${buttonLink('/','Volver al inicio')}`}</main><footer><span>${escapeBrand(identity.productName)} <span class="footer-dot">·</span> ${escapeBrand(identity.organizationName)}</span><span>Unidos para servir.</span></footer></div></div>`;
 const toggle = document.querySelector('[data-action="toggle-nav"]');
 toggle.setAttribute('aria-expanded', String(mobile() ? mobileOpen : !collapsed));
 toggle.setAttribute('aria-controls', 'primary-sidebar');
 document.querySelector('.sidebar').id = 'primary-sidebar';
 const main=document.querySelector('#main');
 if(!allowed)main.innerHTML='<h1>Acceso no disponible</h1><p>No tenés permiso para realizar esta operación.</p>';
 else if(newRoute)mountNewcomers(main,newRoute);
 else if(insightRoute)mountOffice(main,insightRoute);
 else if(identityRoute)mountAdmin(main,identityRoute);
 else if(followRoute)mountFollowup(main,followRoute);
 else if(personRoute)mountPeople(main,personRoute);
 else if(cellRoute)mountCells(main,cellRoute);
 else if(meetingRoute)mountMeetings(main,meetingRoute);
 else if(route?.section.id==='oficina')main.innerHTML=!sessionState.user.access?.allModules?`${pageTitle('MIS ACCESOS','Oficina Manantial','Elegí una herramienta autorizada.')}<div class="cell-actions">${sessionState.user.access.paths.filter(p=>p.path.startsWith('/oficina/')).map(p=>buttonLink(p.path,p.label)).join('')}</div>`:officeLanding(route.area);
 document.title = `${route?.section.name || 'Sección no encontrada'} · ${identity.productName}`;
 document.body.classList.toggle('menu-open', mobile() && mobileOpen);
 if(moveFocus) document.querySelector('#main').focus();
}
app.addEventListener('click', event => {
 const expand = event.target.closest('[data-expand]');
 if(expand) {expanded = expanded===expand.dataset.expand?null:expand.dataset.expand; collapsed=false; render(false,false); document.querySelector(`[data-expand="${expand.dataset.expand}"]`).focus(); return;}
 const action = event.target.closest('[data-action]')?.dataset.action;
 if(action==='logout'){if(canLeaveNewcomers()&&canLeaveIntegration()&&canLeaveAdmin()&&canLeaveFollowup()&&canLeavePeople()&&canLeaveCells()&&canLeaveMeetings()&&canLeaveLeader()&&canLeaveQuick())logout().then(()=>{unmountNewcomers();unmountIntegration();unmountOffice();unmountAdmin();unmountFollowup();unmountPeople();unmountCells();unmountMeetings();unmountLeader();closeQuickPerson();closePersonContext();closeCellContext();app.innerHTML='';showLogin(afterLogin);}).catch(error=>window.alert(error.message));return;}
 if(action==='toggle-nav') {if(mobile()) mobileOpen=!mobileOpen; else collapsed=!collapsed; render(false,false); document.querySelector(mobile()?'.sidebar .brand':'[data-action="toggle-nav"]').focus();}
 if(action==='close') closeMenu();
 if(event.target.closest('a[href^="#/"]') && mobileOpen) {mobileOpen=false; render(false,false);}
});
function closeMenu() {mobileOpen=false; render(false,false); document.querySelector('[data-action="toggle-nav"]').focus();}
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
 if(!canLeaveNewcomers()||!canLeaveIntegration()||!canLeaveAdmin()||!canLeaveFollowup()||!canLeavePeople()||!canLeaveCells()||!canLeaveMeetings()||!canLeaveLeader()||!canLeaveQuick()){history.replaceState(null,'',`${location.pathname}${location.search}${previousHash}`);return;}
 previousHash=location.hash;closeQuickPerson();closePersonContext();closeCellContext();
 const path=location.hash.slice(1),route=resolveRoute(peopleRoute(path)?'/oficina/personas':cellsRoute(path)?'/oficina/celulas':meetingsRoute(path)?'/oficina/asistencia':path);
 expanded=route?.area.children.length?route.area.id:null;mobileOpen=false;render(true);window.scrollTo(0,0);
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
