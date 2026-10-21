// Public installation identity only; credentials never belong in this object.
export const defaultIdentity={productName:'HALO',organizationName:'Manantial de Bendiciones',displayName:'Manantial de Bendiciones',logo:null,favicon:'/src/favicon.svg',initials:'MB',officeName:'Oficina Manantial',churchesName:'Iglesias Manantial',accent:'#285c4c',environment:'local'};
export const identity={...defaultIdentity};
export async function loadIdentity(){
 const response=await fetch('/api/installation',{credentials:'same-origin'});
 if(!response.ok)throw new Error('No pudimos cargar la identidad de la instalación.');
 Object.assign(identity,await response.json());
 document.title=identity.productName+' · '+identity.organizationName;
 document.querySelector('meta[name="description"]').content=identity.productName+' · '+identity.organizationName;
 let favicon=document.querySelector('link[rel="icon"]');if(!favicon){favicon=document.createElement('link');favicon.rel='icon';document.head.append(favicon);}favicon.href=identity.favicon;
}
