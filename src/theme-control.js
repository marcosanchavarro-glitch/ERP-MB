import {icon} from './icons.js';
export function themeControl(){
  const preference=typeof document==='undefined'?'light':document.documentElement.dataset.themePreference||'light';
  return `<details class="theme-picker"><summary aria-label="Elegir tema" title="Apariencia">${icon('screen')}</summary><div class="theme-popover"><label>Apariencia<select aria-label="Tema de la interfaz" data-theme-preference-control>${Object.entries({light:'Claro',dark:'Oscuro',system:'Sistema'}).map(([value,label])=>`<option value="${value}" ${preference===value?'selected':''}>${label}</option>`).join('')}</select></label><small>Sistema sigue la apariencia de tu dispositivo.</small></div></details>`;
}
export function themeContext(area='',subarea=''){
  document.documentElement.dataset.themeArea=area;
  document.documentElement.dataset.themeSubarea=subarea;
}
