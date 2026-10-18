// Blocking, same-origin head script: resolve saved theme before styles/first paint.
// No account or business state; unavailable storage falls back to this tab's choice.
(() => {
  const key='erp.theme',root=document.documentElement,system=matchMedia('(prefers-color-scheme: dark)');
  const valid=value=>['light','dark','system'].includes(value);
  let preference='light';
  try{const saved=localStorage.getItem(key);if(valid(saved))preference=saved;}catch{}
  function apply(){
    const theme=preference==='system'?(system.matches?'dark':'light'):preference;
    root.dataset.theme=theme;root.dataset.themePreference=preference;
    document.querySelectorAll('[data-theme-preference-control]').forEach(control=>{control.value=preference;});
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta){const color=getComputedStyle(root).getPropertyValue('--color-background').trim();if(color)meta.content=color;}
  }
  apply();
  document.addEventListener('DOMContentLoaded',apply,{once:true});
  system.addEventListener('change',()=>{if(preference==='system')apply();});
  window.addEventListener('storage',event=>{if(event.key===key||event.key===null){preference=valid(event.newValue)?event.newValue:'light';apply();}});
  document.addEventListener('change',event=>{
    if(!event.target.matches('[data-theme-preference-control]')||!valid(event.target.value))return;
    preference=event.target.value;try{localStorage.setItem(key,preference);}catch{}apply();
  });
  document.addEventListener('click',event=>document.querySelectorAll('.theme-picker[open]').forEach(picker=>{if(!picker.contains(event.target))picker.open=false;}));
  document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;const picker=event.target.closest('.theme-picker[open]');if(picker){event.preventDefault();event.stopPropagation();picker.open=false;picker.querySelector('summary').focus();}},true);
})();
