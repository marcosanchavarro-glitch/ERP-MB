import {branding} from './branding.mjs';
export function readConfig(env=process.env) {
 const mode=env.NODE_ENV || 'development';
 if(!['development','test','production'].includes(mode))throw new Error('NODE_ENV inválido.');
 const production=mode==='production';
 if(!env.DATABASE_URL)throw new Error('Falta DATABASE_URL. Ejecutá npm run db:local o configurá PostgreSQL.');
 if(!env.SESSION_SECRET || env.SESSION_SECRET.length<48 || new Set(env.SESSION_SECRET).size<12)throw new Error('SESSION_SECRET debe tener al menos 48 caracteres aleatorios, sin patrones triviales.');
 const configuredOrigin=env.APP_ORIGIN||env.APP_URL||(env.RENDER==='true'?env.RENDER_EXTERNAL_URL:null);
 const origin=new URL(configuredOrigin || 'http://127.0.0.1:5173');
 if(production&&origin.protocol!=='https:')throw new Error('APP_ORIGIN debe utilizar HTTPS en producción.');
 if(production&&!configuredOrigin)throw new Error('Falta APP_ORIGIN en producción.');
 if(origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password)throw new Error('APP_ORIGIN debe contener solo esquema, host y puerto.');
 if(['true','*','1'].includes(env.TRUST_PROXY))throw new Error('TRUST_PROXY debe identificar IP/CIDR de proxies conocidos.');
 const number=(name,fallback,min=1,max=86400000)=>{const n=Number(env[name]||fallback);if(!Number.isInteger(n)||n<min||n>max)throw new Error(`${name} fuera de rango.`);return n;};
 return {mode,production,branding:branding(env),databaseUrl:env.DATABASE_URL,sessionSecret:env.SESSION_SECRET,origin:origin.origin,
  port:number('PORT',5173,0,65535),host:env.HOST || (env.RENDER==='true'?'0.0.0.0':'127.0.0.1'),trustProxy:env.TRUST_PROXY || false,
  sessionTtl:number('SESSION_TTL_MS',8*60*60*1000),loginLimit:number('LOGIN_LIMIT',20),loginWindow:number('LOGIN_WINDOW_MS',15*60*1000),apiLimit:number('API_LIMIT',300),
  dbSsl:env.DB_SSL==='true',dbCa:env.DB_CA_FILE || null};
}
