// Only CSRF state is held in JS memory. The session identifier is HttpOnly.
export const sessionState={user:null,csrfToken:null};
export async function authRequest(path,options={}) {
 const response=await fetch(`/api/auth${path}`,{...options,headers:{'Content-Type':'application/json',...(sessionState.csrfToken?{'X-CSRF-Token':sessionState.csrfToken}:{}),...options.headers}});
 const data=await response.json();
 if(!response.ok)throw new Error(data.message || 'No pudimos iniciar sesión.');
 return data;
}
export async function refreshSession() {
 const data=await authRequest('/session');sessionState.user=data.user;sessionState.csrfToken=data.csrfToken;return data;
}
