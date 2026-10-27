import {haloBackdrop,haloOrbit,haloPortalGraphic} from './ui/halo.js';
import {themeControl} from './theme-control.js';
import {officeNavigationGroups,sectionDescriptions} from './navigation-presentation.js';
import {identity, statuses, navigation} from './config.js';
export const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
import {icon, moduleIcon} from './icons.js';
export const badge = status => `<span class="badge ${status.toLowerCase()}"><span></span>${statuses[status]}</span>`;
export const buttonLink = (path,label) => `<a class="button" href="#${path}">${escape(label)}${icon('arrow')}</a>`;
function navigationChildren(area,route){
 const link=child=>`<a href="#${escape(child.path)}" ${route?.section.id===child.id?'aria-current="page"':''}>${moduleIcon(child)}<span>${escape(child.name)}</span></a>`;
 return area.id==='oficina'?officeNavigationGroups(area.children).map(group=>`<details class="office-nav-group" data-office-nav-group="${group.id}" open><summary>${escape(group.name)}${icon('chevron')}</summary><div class="office-nav-items">${group.items.map(link).join('')}</div></details>`).join(''):area.children.map(link).join('');
}
export function sidebar(route, expanded, modules = navigation) {
 return `<div class="sidebar-head"><a class="brand" href="#/" aria-label="${escape(identity.productName)} — Inicio"><span class="brand-mark">${icon('layers')}</span><span class="brand-text">${escape(identity.productName)}<small>ESPACIO DE TRABAJO</small></span></a><button class="icon-button mobile-only" data-action="close" aria-label="Cerrar navegación">${icon('close')}</button></div><div class="nav-caption">PRINCIPAL</div><nav aria-label="Navegación principal">${modules.map(area => `<div class="nav-group"><div class="nav-row ${route?.area.id===area.id?'selected':''}"><a href="#${area.path}" title="${escape(area.name)}" ${route?.section.id===area.id?'aria-current="page"':''}>${moduleIcon(area)}<span class="nav-label">${escape(area.name)}</span></a>${area.children.length?`<button class="expand-button" data-expand="${area.id}" aria-label="Subsecciones de ${escape(area.name)}" aria-expanded="${expanded===area.id}" aria-controls="children-${area.id}">${icon('chevron')}</button>`:''}</div>${area.children.length?`<div id="children-${area.id}" class="nav-children" ${expanded===area.id?'':'hidden'}>${navigationChildren(area,route)}</div>`:''}</div>`).join('')}</nav><div class="sidebar-bottom"><span class="organization-avatar">${escape(identity.initials)}</span><div class="organization-text"><strong>${escape(identity.displayName)}</strong><small>Organización actual</small></div></div>`;
}
export function topbar(route, user = null) {
 return `<div class="context"><button type="button" class="icon-button" data-action="toggle-nav" aria-label="Alternar navegación">${icon('panel')}</button><strong>${escape(route?.area.name || 'Sección no encontrada')}</strong>${route && route.section!==route.area?`<span class="separator">/</span><strong>${escape(route.section.name)}</strong>`:''}</div><div class="topbar-tools">${themeControl()}<div class="user" title="${escape(user?.username || 'Sin sesión')}"><span class="user-avatar">${escape(user?.username?.slice(0,2).toUpperCase() || '—')}</span><span class="session-label">${escape(user?.username || 'Sin sesión')}</span></div>${user?`<button type="button" class="session-logout" data-action="logout" aria-label="Cerrar sesión" title="Cerrar sesión">${icon('door')}<span>Cerrar sesión</span></button>`:''}</div>`;

}
export const pageTitle = (eyebrow,title,description) => `<div class="page-title halo-heading">${haloBackdrop()}<div class="halo-heading-content"><div class="eyebrow">${escape(eyebrow)}</div><h1>${escape(title)}</h1>${description?`<p>${escape(description)}</p>`:''}</div></div>`;
const displayText=(value,fallback='')=>typeof value==='string'&&value.trim()&&!['undefined','null','NaN','[object Object]'].includes(value.trim())?value.trim():fallback;
export function home(modules = navigation, user = null) {
 const name=displayText(user?.username);
 return `<div class="halo-home halo-workspace-home"><section class="welcome halo-feature"><div class="halo-welcome-copy"><h1>${name?'Hola, <span>'+escape(name)+'</span>.':'Hola.'}</h1><p class="halo-intro">Este es tu espacio de trabajo en HALO</p></div></section><div data-home-work></div></div>`;
}
export function placeholder(route) {
 const {area,section} = route;
 if(area.id==='territorio'&&section.id===area.id){const tools=area.children.filter(c=>c.status==='ACTIVE');return `${pageTitle('ÁREA DE TRABAJO','Territorio','Consultá sedes, células, organización geográfica y actividades registradas.')}<section class="planned-sections"><h2>Herramientas de Territorio</h2><p>Las sedes y células se consultan desde el mapa; las zonas y sectores se administran en Análisis territorial.</p><div class="section-list">${tools.map(child=>`<a href="#${escape(child.path)}">${moduleIcon(child)}<span><strong>${escape(child.name)}</strong><small>${escape(sectionDescriptions[child.id]||'')}</small></span>${icon('arrow')}</a>`).join('')||'<p>No hay herramientas disponibles para esta consulta.</p>'}</div></section>`;}
 return `${pageTitle(area.name,section.name,section.description||sectionDescriptions[section.id]||'')}<section class="placeholder"><span class="placeholder-icon">${moduleIcon(section)}</span>${badge(section.status)}<h2>En preparación</h2><p>Las herramientas de esta sección todavía no están disponibles.</p>${buttonLink('/','Volver al inicio')}</section>${section.children.length?`<section class="planned-sections"><h2>Secciones previstas</h2><div class="section-list">${section.children.map(child=>`<a href="#${child.path}">${moduleIcon(child)}<span>${escape(child.name)}</span>${badge(child.status)}${icon('arrow')}</a>`).join('')}</div></section>`:''}`;
}

export function officeLanding(area) {
 return `${pageTitle('ÁREA DE TRABAJO',area.name,'Información central y acompañamiento de la comunidad.')}<section class="office-ready"><div>${badge('ACTIVE')}<h2>Personas / Matriz</h2><p>Consultá, registrá y actualizá personas desde una única base central.</p></div>${buttonLink('/oficina/personas','Abrir Personas / Matriz')}</section><section class="planned-sections"><h2>Secciones de Oficina</h2><div class="section-list">${area.children.map(child=>`<a href="#${child.path}">${moduleIcon(child)}<span>${escape(child.name)}</span>${badge(child.status)}${icon('arrow')}</a>`).join('')}</div></section>`;
}
