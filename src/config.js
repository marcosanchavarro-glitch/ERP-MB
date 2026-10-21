import {resolveIconId} from './icons.js';

import {identity} from './branding.js';
export {identity};
export const statuses = { PLANNED: 'Próximamente', DEVELOPMENT: 'En desarrollo', ACTIVE: 'Disponible' };
const section = (id, name, icon, description, children = []) => ({ id, name, icon, defaultIcon: icon, description, path: `/${id}`, status: id==='recepcion'?'ACTIVE':['oficina','administracion','territorio'].includes(id)?'DEVELOPMENT':'PLANNED', children: children.map(([key, label, childIcon]) => ({id: `${id}-${key}`, name: label, icon: childIcon, defaultIcon: childIcon, path: `/${id}/${key}`, status: (id==='oficina'&&['personas','celulas','asistencia','seguimiento','cumpleanos','calidad','nuevos','citas','importar-exportar','dashboard','trabajo'].includes(key)||id==='administracion'&&['usuarios','roles','auditoria'].includes(key)||id==='territorio'&&key==='mapa')?'ACTIVE':'PLANNED', children: []})) });
const defaultNavigation = [
  {id:'inicio', name:'Inicio', icon:'home', defaultIcon:'home', path:'/', status:'ACTIVE', children:[]},
  section('oficina', identity.officeName, 'office', 'Organización y acompañamiento de la comunidad.', [['trabajo','Mi trabajo','office'],['dashboard','Dashboard','panel'],['personas','Personas / Matriz','people'],['celulas','Células','people'],['asistencia','Asistencia','clock'],['seguimiento','Seguimiento','search'],['nuevos','Nuevos','spark'],['citas','Citas','clock'],['cumpleanos','Cumpleaños','spark'],['calidad','Calidad de datos','search'],['importar-exportar','Importar / Exportar','arrow'],['auditoria','Auditoría','search']]),
  section('hdr','HDR','people','Un espacio para cada etapa de la vida.', [['pekes','Pekes','people'],['preadolescentes','Preadolescentes','people'],['jovenes','Adolescentes y Jóvenes','people'],['universitarios','Universitarios','book']]),
  section('musica-sonido','Música y Sonido','music','Música y soporte sonoro para cada encuentro.', [['musica','Música','music'],['sonido','Sonido','screen']]),
  section('multimedia','Multimedia','screen','Comunicación, creatividad y medios.', [['pantalla','Pantalla','screen'],['transmision','Transmisión','screen'],['fotografia','Fotografía','art'],['redes','Redes','people'],['diseno','Diseño','art']]),
  section('recepcion','Recepción','door','La bienvenida a nuestra comunidad.'),
  section('hdr-arte','HDR Arte','art','Expresión artística al servicio de la iglesia.'),
  section('limpieza','Limpieza','spark','El cuidado de nuestros espacios.'),
  section('comedor','Comedor','cup','Servicio y encuentro alrededor de la mesa.'),
  section('formacion','Formación','book','Espacios para aprender y crecer.', [['adn','Escuela de ADN','book']]),
  section('tesoreria','Tesorería','wallet','Administración de los recursos de la iglesia.'),
  section('territorio','Territorio','map','La comunidad y su presencia en el territorio.', [['general','Vista general','panel'],['mapa','Mapa de células','map'],['cobertura','Cobertura','map'],['evangelismo','Evangelismo','people'],['iglesias',identity.churchesName,'office']]),
  section('administracion','Administración','settings','Organización y configuración del ERP.', [['usuarios','Usuarios','people'],['roles','Perfiles de acceso','settings'],['areas','Áreas','layers'],['configuracion','Configuración','settings'],['auditoria','Auditoría general','search']])
];
// Future stored visual preferences: a plain JSON map of module ID -> icon ID.
// Omit a module's key to restore its configured default. No persistence or editor in 0.1.
export function createNavigation(iconOverrides = {}) {
  const visit = node => ({
    ...node,
    icon: resolveIconId(Object.hasOwn(iconOverrides, node.id) ? iconOverrides[node.id] : node.icon, node.defaultIcon),
    children: node.children.map(visit)
  });
  return defaultNavigation.map(visit);
}
export const navigation = createNavigation();
// Contextual portal entry uses the same configurable icon contract as the main modules.
export function createLeaderNavigation(iconOverrides={}){const id='mi-celula',defaultIcon='people';return {id,name:'Mi Célula',description:'Reuniones e integrantes de tu célula.',icon:resolveIconId(iconOverrides[id],defaultIcon),defaultIcon,path:'/mi-celula',status:'ACTIVE',children:[]};}
export const leaderNavigation=createLeaderNavigation();

export function resolveRoute(path, modules = navigation) {
  for (const area of modules) {
    if (area.path === path) return {area, section: area};
    const child = area.children.find(item => item.path === path);
    if (child) return {area, section: child};
  }
  return null;
}
