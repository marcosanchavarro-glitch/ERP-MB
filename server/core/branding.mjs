import {defaultIdentity} from '../../src/branding.js';
export function branding(env=process.env){
 const label=(key,fallback)=>{const value=(env[key]||fallback).trim();if(!value||value.length>120)throw new Error(key+' inválido.');return value;};
 const asset=(key,fallback)=>{const value=env[key]||fallback;if(value!==null&&(!/^\/src\/[a-zA-Z0-9/_-]+\.(svg|png|ico|webp|jpg)$/.test(value)||value.includes('..')))throw new Error(key+' debe ser un recurso local /src/.');return value;};
 const productName=label('APP_NAME',defaultIdentity.productName),organizationName=label('ORGANIZATION_NAME',defaultIdentity.organizationName);
 return {...defaultIdentity,productName,organizationName,displayName:organizationName,initials:organizationName.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase(),logo:asset('APP_LOGO_PATH',null),favicon:asset('APP_FAVICON_PATH',defaultIdentity.favicon),environment:env.APP_ENV||'local'};
}
