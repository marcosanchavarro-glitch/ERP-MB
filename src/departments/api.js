import {sessionState} from '../auth/session.js';
export async function departmentRequest(path,options={}){
 const owner=sessionState.user?.id,csrf=sessionState.csrfToken;
 let response;try{response=await fetch('/api/departments'+path,{...options,headers:{'Content-Type':'application/json',...(sessionState.csrfToken?{'X-CSRF-Token':sessionState.csrfToken}:{}),...options.headers}});}catch{throw new Error('No pudimos conectar. Tus cambios siguen en pantalla.');}
 let data;try{data=await response.json();}catch{throw new Error('No pudimos completar la consulta. Reintentá.');}
 if(!response.ok){if(response.status===401&&owner===sessionState.user?.id&&csrf===sessionState.csrfToken&&!options.signal?.aborted)window.dispatchEvent(new Event('session-expired'));throw Object.assign(new Error(data.message||'No pudimos completar la operación.'),{status:response.status});}return data;
}
