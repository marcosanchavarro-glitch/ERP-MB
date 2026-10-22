// One SDK load per document, shared by Territorio and location editors.
let sdk,authFailed=false;
export function loadGoogleMaps(config){
 if(!config?.configured)return Promise.reject(new Error('GOOGLE_CONFIG_MISSING'));
 if(authFailed)return Promise.reject(new Error('GOOGLE_AUTH_FAILED'));
 if(!sdk){sdk=new Promise((resolve,reject)=>{
  let done=false;const script=document.createElement('script'),callback='__haloGoogleMapsReady';
  const finish=(error)=>{if(done)return;done=true;clearTimeout(timer);if(error){window[callback]=()=>{};script.remove();reject(new Error(error));}else{delete window[callback];resolve(window.google.maps);}};
  const timer=setTimeout(()=>finish('GOOGLE_LOAD_FAILED'),12000);
  window.gm_authFailure=()=>{authFailed=true;finish('GOOGLE_AUTH_FAILED');window.dispatchEvent(new Event('halo-google-auth-failure'));};
  window[callback]=()=>{if(!window.google?.maps?.importLibrary)return finish('GOOGLE_LOAD_FAILED');finish();};
  const url=new URL('https://maps.googleapis.com/maps/api/js');url.search=new URLSearchParams({key:config.apiKey,v:'weekly',loading:'async',callback,language:'es',region:'AR',auth_referrer_policy:'origin'});
  script.src=url;script.async=true;script.referrerPolicy='origin';script.nonce=document.querySelector('script[nonce]')?.nonce||'';script.onerror=()=>finish('GOOGLE_LOAD_FAILED');document.head.append(script);
 }).then(async maps=>{let timer;try{await Promise.race([Promise.all([maps.importLibrary('maps'),maps.importLibrary('marker')]),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('GOOGLE_LOAD_FAILED')),12000);})]);return maps;}finally{clearTimeout(timer);}});}
 // Failed loads stay failed until document reload: filters must never trigger repeated SDK loads.
 return sdk;
}
