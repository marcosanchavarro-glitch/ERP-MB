let leaflet;
export async function loadLeaflet(){
 if(!leaflet){
  const css=new Promise((resolve,reject)=>{const link=document.createElement('link'),timer=setTimeout(()=>{link.remove();reject(new Error('Map CSS timeout'));},10000);link.rel='stylesheet';link.href='/vendor/leaflet/leaflet.css';link.onload=()=>{clearTimeout(timer);resolve();};link.onerror=()=>{clearTimeout(timer);link.remove();reject(new Error('Map CSS unavailable'));};document.head.append(link);});
  leaflet=Promise.all([import('/vendor/leaflet/leaflet-src.esm.js'),css]).then(([L])=>L).catch(error=>{leaflet=null;throw error;});
 }
 return leaflet;
}
