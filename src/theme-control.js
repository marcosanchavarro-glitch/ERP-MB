import {icon} from './icons.js';
export function themeControl(){
  const preference=typeof document==='undefined'?'light':document.documentElement.dataset.themePreference||'light';
  const dark=typeof document!=='undefined'&&document.documentElement.dataset.theme==='dark';
  return `<div class="theme-control"><button type="button" class="theme-switch" role="switch" aria-label="Modo oscuro" aria-checked="${dark}" data-theme-switch title="${dark?'Cambiar a modo claro':'Cambiar a modo oscuro'}"><span class="theme-switch-track" aria-hidden="true"><span class="theme-switch-thumb">${icon('sun','theme-sun')}${icon('moon','theme-moon')}</span></span></button><details class="theme-picker"><summary aria-label="Preferencia de apariencia" title="Preferencia de apariencia">${icon('chevron')}</summary><div class="theme-popover"><label>Apariencia<select aria-label="Tema de la interfaz" data-theme-preference-control>${Object.entries({light:'Claro',dark:'Oscuro',system:'Automático'}).map(([value,label])=>`<option value="${value}" ${preference===value?'selected':''}>${label}</option>`).join('')}</select></label><small>Automático sigue la apariencia de tu dispositivo.</small></div></details></div>`;
}
export function themeContext(area='',subarea=''){
  document.documentElement.dataset.themeArea=area;
  document.documentElement.dataset.themeSubarea=subarea;
}
