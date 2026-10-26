// Independent of the application module: keep a recovery path if an import fails.
(() => {
 let timer;
 const starting=()=>!document.querySelector('#login-form,.shell,.leader-header');
 function fail(message='No pudimos cargar todos los recursos de HALO. Revisá la conexión y volvé a intentar.'){
  if(!starting())return;clearTimeout(timer);const app=document.querySelector('#app');if(!app)return;
  app.hidden=false;app.replaceChildren();const section=document.createElement('section');section.className='startup-status';section.setAttribute('role','alert');
  const title=document.createElement('h1');title.textContent='HALO';const text=document.createElement('p');text.textContent=message;
  const retry=document.createElement('button');retry.type='button';retry.className='button';retry.textContent='Reintentar carga';retry.addEventListener('click',()=>location.reload());
  section.append(title,text,retry);app.append(section);
 }
 window.HaloStartup={fail};
 window.addEventListener('error',event=>{if(event.target?.matches?.('script[src],link[rel=stylesheet]')||event instanceof ErrorEvent)fail();},true);
 window.addEventListener('unhandledrejection',()=>fail());
 document.addEventListener('DOMContentLoaded',()=>{timer=setTimeout(()=>fail('La carga está demorando más de lo esperado. Podés reintentar sin cambiar la dirección de esta pantalla.'),30000);},{once:true});
})();
