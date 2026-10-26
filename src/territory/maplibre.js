let loading;
export async function loadMapLibre(){
 if(!loading){
  const css=new Promise((resolve,reject)=>{const link=document.createElement('link'),timer=setTimeout(()=>{link.remove();reject(new Error('Map CSS timeout'));},10000);link.rel='stylesheet';link.href='/vendor/maplibre/maplibre-gl.css';link.onload=()=>{clearTimeout(timer);resolve();};link.onerror=()=>{clearTimeout(timer);link.remove();reject(new Error('Map CSS unavailable'));};document.head.append(link);});
  loading=Promise.all([import('/vendor/maplibre/maplibre-gl.mjs'),css]).then(([M])=>{M.setWorkerUrl('/vendor/maplibre/maplibre-gl-worker.mjs');M.setWorkerCount(1);return M;}).catch(error=>{loading=null;throw error;});
 }
 return loading;
}
