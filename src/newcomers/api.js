import {sessionState} from '../auth/session.js';
export async function request(path='',body,endpoint='/api/newcomers'){
 const r=await fetch(endpoint+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-CSRF-Token':sessionState.csrfToken||''},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json();if(!r.ok){if(r.status===401)window.dispatchEvent(new Event('session-expired'));throw Object.assign(new Error(data.message),data,{status:r.status});}return data;
}
