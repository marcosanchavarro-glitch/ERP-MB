import {Router} from 'express';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import {rateLimit} from 'express-rate-limit';
import {randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {identityService} from './service.mjs';
import {principal} from './authorization.mjs';
import {publicUser} from './presentation.mjs';
import {DomainError} from '../core/errors.mjs';
import {appendAudit} from '../audit/repository.mjs';
import {log} from '../core/logger.mjs';
const call=(object,method)=>new Promise((resolve,reject)=>object[method](error=>error?reject(error):resolve()));
export function csrfGuard(req,res,next) {
 const supplied=req.headers['x-csrf-token'],expected=req.session?.csrf;
 if(typeof supplied!=='string'||! /^[0-9a-f]{64}$/.test(supplied)||typeof expected!=='string'||supplied.length!==expected.length||!timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return next(new DomainError(403,'La solicitud de seguridad venció. Recargá la sesión e intentá nuevamente.',{code:'CSRF_REJECTED'}));
 next();
}
export async function installIdentity(app,pool,config) {
 const PgStore=connectPg(session),store=new PgStore({pool,tableName:'sessions',createTableIfMissing:false,pruneSessionInterval:60,errorLog:()=>log('error','session_store_error')});
 const cookieName=config.production?'__Host-erp.sid':'erp.sid';
 app.use('/api',session({store,name:cookieName,secret:config.sessionSecret,resave:false,saveUninitialized:false,rolling:false,
  cookie:{httpOnly:true,secure:config.production,sameSite:'strict',path:'/',maxAge:config.sessionTtl}}));
 app.use('/api',async(req,res,next)=>{
  if(req.session.userId){
   if(!req.session.authenticatedAt||Date.now()-req.session.authenticatedAt>=config.sessionTtl){await call(req.session,'destroy');return next(new DomainError(401,'Tu sesión venció. Volvé a iniciar sesión.',{code:'SESSION_EXPIRED'}));}
   req.user=await principal(pool,req.session.userId);
   if(!req.user){await call(req.session,'destroy');return next(new DomainError(401,'Tu sesión ya no está disponible.',{code:'SESSION_REVOKED'}));}
  }
  next();
 });
 const service=await identityService(pool),router=Router();
 const limited=(limit,keyGenerator)=>rateLimit({windowMs:config.loginWindow,limit,standardHeaders:'draft-8',legacyHeaders:false,skipSuccessfulRequests:true,...(keyGenerator?{keyGenerator}:{}),handler:(req,res,next)=>{log('security','login_rate_limit',{requestId:req.requestId});next(new DomainError(429,'Demasiados intentos. Esperá unos minutos antes de volver a intentar.'));}});
 router.get('/session',async(req,res)=>{
  if(!req.session.csrf)req.session.csrf=randomBytes(32).toString('hex');
  res.json({authenticated:Boolean(req.user),user:publicUser(req.user),csrfToken:req.session.csrf});
 });
 router.post('/login',limited(config.loginLimit),limited(config.loginLimit,req=>createHash('sha256').update(String(req.body?.username || '').trim().toLowerCase().slice(0,100)).digest('hex')),csrfGuard,async(req,res)=>{
  if(!req.body||Object.keys(req.body).some(key=>!['username','password'].includes(key)))throw new DomainError(422,'Datos de acceso inválidos.');
  let user;
  try{user=await service.authenticate(req.body.username,req.body.password);}catch(error){log('security','login_failed',{requestId:req.requestId});throw error;}
  await call(req.session,'regenerate');
  req.session.userId=user.id;req.session.authenticatedAt=Date.now();req.session.csrf=randomBytes(32).toString('hex');
  await call(req.session,'save');
  await appendAudit(pool,{actorId:user.id,action:'LOGIN',entity:'USER',entityId:user.id,context:{requestId:req.requestId}});
  log('security','login_success',{actorId:user.id,requestId:req.requestId});
  res.json({authenticated:true,user:publicUser(await principal(pool,user.id)),csrfToken:req.session.csrf});
 });
 router.post('/logout',csrfGuard,async(req,res)=>{
  const actorId=req.user?.id;
  await call(req.session,'destroy');res.clearCookie(cookieName,{httpOnly:true,secure:config.production,sameSite:'strict',path:'/'});
  if(actorId)await appendAudit(pool,{actorId,action:'LOGOUT',entity:'USER',entityId:actorId});
  res.json({ok:true});
 });
 app.use('/api/auth',router);
 return store;
}
