// Presentation only: bounded options, no account state, requests or business rules.
const pick=(value,allowed,fallback)=>allowed.includes(value)?value:fallback;
export function haloBackdrop({tone='context',intensity='medium',position='right',variant='aurora'}={}){
 return `<span class="halo-backdrop" data-halo-tone="${pick(tone,['context','warm','sky','earth'],'context')}" data-halo-intensity="${pick(intensity,['low','medium','high'],'medium')}" data-halo-position="${pick(position,['left','right','center'],'right')}" data-halo-variant="${pick(variant,['aurora','rings','wash'],'aurora')}" aria-hidden="true"></span>`;
}
export function haloOrbit({progress=null,decorative=true}={}){
 if(typeof progress==='number'&&Number.isFinite(progress)){const value=Math.min(100,Math.max(0,progress));return `<div class="halo-orbit halo-orbit--progress"${decorative?' aria-hidden="true"':''}><svg viewBox="0 0 100 100"${decorative?' focusable="false"':' role="progressbar" aria-label="Progreso" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+value+'"'}><circle class="halo-orbit-track" cx="50" cy="50" r="44"/><circle class="halo-orbit-value" cx="50" cy="50" r="44" pathLength="100" stroke-dasharray="${value} 100"/></svg></div>`;}
 return '<div class="halo-orbit" aria-hidden="true"><i></i><i></i><i></i><span class="halo-nucleus"></span></div>';
}
export const glassClass=(variant='neutral')=>'halo-glass halo-glass--'+pick(variant,['dark','light','warm','neutral','feature'],'neutral');
