let leaflet;
export async function loadLeaflet(){
 if(!leaflet){
  const css=new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/vendor/leaflet/leaflet.css';link.onload=resolve;link.onerror=reject;document.head.append(link);});
  leaflet=Promise.all([import('/vendor/leaflet/leaflet-src.esm.js'),css]).then(([L])=>L).catch(error=>{leaflet=null;throw error;});
 }
 return leaflet;
}
