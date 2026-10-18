import {themeControl,themeContext} from '../theme-control.js';
import {identity} from '../config.js';
import {escape as e} from '../components.js';
import {sessionState,authRequest,refreshSession} from './session.js';
let gate=null;
export function showLogin(onSuccess,{expired=false}={}) {
 if(gate)return;themeContext();
 document.querySelector('#app').hidden=true;
 gate=document.createElement('main');gate.className='login-page';
 gate.innerHTML=`<section class="login-card">${themeControl()}${identity.logo?`<img class="login-logo" src="${e(identity.logo)}" alt="Logo de la organización">`:""}${identity.environment==='demo'?'<p class="demo-label">DEMO · Solo datos ficticios</p>':''}<div class="eyebrow">${e(identity.organizationName)}</div><h1>${e(identity.productName)}</h1><p>${expired?'Tu sesión venció o fue revocada. Iniciá sesión para continuar.':'Ingresá con tu cuenta habilitada.'}</p><form id="login-form"><label for="login-username">Usuario</label><input id="login-username" name="username" autocomplete="username" required maxlength="100"><label for="login-password">Contraseña</label><input id="login-password" name="password" type="password" autocomplete="current-password" required maxlength="256"><p id="login-error" role="alert"></p><button class="button" type="submit">Iniciar sesión</button></form><small>Las cuentas se crean administrativamente. No hay registro público.</small></section>`;
 document.body.append(gate);gate.querySelector('input').focus();
 gate.querySelector('form').onsubmit=async event=>{
  event.preventDefault();const form=event.target,button=form.querySelector('button'),message=form.querySelector('#login-error');button.disabled=true;message.textContent='';
  try {
   // Obtain a fresh anonymous CSRF token when an old session expired.
   try{await refreshSession();}catch{await refreshSession();}
   const data=await authRequest('/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});
   sessionState.user=data.user;sessionState.csrfToken=data.csrfToken;
   gate.remove();gate=null;document.querySelector('#app').hidden=false;onSuccess();
  }catch(error){message.textContent=error.message || 'No pudimos conectar con el servidor.';form.querySelector('[name=password]').value='';}
  finally{button.disabled=false;}
 };
}
export async function logout() {
 await authRequest('/logout',{method:'POST',body:'{}'});sessionState.user=null;sessionState.csrfToken=null;
}
