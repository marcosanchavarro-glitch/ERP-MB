import {sessionState} from '../auth/session.js';
export async function request(path='',options={}) {
 let response;
 try {response=await fetch(`/api/people${path}`,{...options,headers:{'Content-Type':'application/json',...(sessionState.csrfToken?{'X-CSRF-Token':sessionState.csrfToken}:{}),...options.headers}});} catch {throw new Error('No pudimos conectar con el servidor. Tus cambios siguen en pantalla.');}
 let data;
 try {data=await response.json();}catch{throw new Error('El servidor no pudo responder. Intentá nuevamente.');}
 if(!response.ok) {if(response.status===401)window.dispatchEvent(new Event('session-expired'));const error=new Error(data.message || 'No pudimos completar la operación.');Object.assign(error,data);throw error;}
 return data;
}
