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
// Decorative navigation geometry, never a visualization of business data.
export function haloPortalGraphic(id=''){
 const kind=typeof id==='string'?id:'';
 let drawing;
 if(kind.includes('personas'))drawing='<path d="M30 30L60 20 90 30 80 65 40 65Z M30 30L80 65M90 30L40 65"/><circle cx="30" cy="30" r="10"/><circle cx="60" cy="20" r="9"/><circle cx="90" cy="30" r="10"/><circle cx="40" cy="65" r="11"/><circle cx="80" cy="65" r="11"/>';
 else if(kind.includes('mi-celula')||kind.includes('celulas'))drawing='<circle cx="60" cy="45" r="32"/><path d="M60 45L25 22M60 45L95 22M60 45V80"/><circle cx="25" cy="22" r="7"/><circle cx="95" cy="22" r="7"/><circle cx="60" cy="80" r="7"/><circle class="halo-graphic-core" cx="60" cy="45" r="15"/>';
 else if(kind.includes('multimedia')||kind.includes('musica'))drawing='<path d="M12 45Q25 5 38 45T64 45T90 45T116 45 M12 55Q25 15 38 55T64 55T90 55T116 55"/><circle class="halo-graphic-core" cx="64" cy="45" r="7"/>';
 else if(kind.includes('formacion'))drawing='<circle cx="35" cy="45" r="22"/><circle cx="60" cy="45" r="28"/><circle cx="85" cy="45" r="22"/><path d="M20 45H100"/>';
 else if(kind.includes('asistencia')||kind.includes('administracion'))drawing=Array.from({length:9},(_,i)=>`<circle${[0,4,7].includes(i)?' class="halo-graphic-core"':''} cx="${32+i%3*28}" cy="${17+Math.floor(i/3)*28}" r="8"/>`).join('');
 else if(kind.includes('trabajo'))drawing='<path d="M15 65H42V48H70V28H105"/><circle cx="15" cy="65" r="6"/><circle cx="42" cy="48" r="7"/><circle cx="70" cy="28" r="8"/><circle class="halo-graphic-core" cx="105" cy="28" r="10"/>';
 else drawing='<ellipse cx="60" cy="45" rx="48" ry="22" transform="rotate(-25 60 45)"/><circle cx="60" cy="45" r="35"/><circle class="halo-graphic-core" cx="60" cy="45" r="12"/><circle cx="92" cy="30" r="5"/>';
 return `<svg class="halo-portal-graphic" viewBox="0 0 120 90" aria-hidden="true" focusable="false">${drawing}</svg>`;
}
