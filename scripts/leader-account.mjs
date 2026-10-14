import {readConfig} from '../server/core/config.mjs';
import {createPool} from '../server/db/pool.mjs';
import {createUser} from '../server/identity/service.mjs';
import {leaderRole,authorizeLeaderAccount} from '../server/identity/leader-accounts.mjs';
import {validUuid} from '../src/domain/cell.js';
const args=process.argv.slice(2),value=key=>args.find(a=>a.startsWith('--'+key+'='))?.slice(key.length+3);
const allowed=/^--(create|disable|password-stdin)$|^--(username|person|user)=/;
if(args.some(a=>!allowed.test(a)))throw new Error('Argumento no admitido. Ver docs/PORTAL-LIDER.md.');
const creating=args.includes('--create'),disabled=args.includes('--disable'),personId=value('person');
if(creating&&(!args.includes('--password-stdin')||disabled||value('user')))throw new Error('Crear requiere --username, --person y --password-stdin.');
if(!disabled&&!validUuid(personId))throw new Error('Indicá --person=UUID.');
const config=readConfig(),db=createPool({...config,databaseUrl:process.env.MIGRATION_DATABASE_URL||config.databaseUrl});
try{if(creating){const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);const password=Buffer.concat(chunks).toString('utf8').replace(/[\r\n]+$/,'');
 const roleId=await leaderRole(db),user=await createUser(db,{username:value('username'),password,personId,grants:[{roleId,scopeType:'global'}],actorId:'system:leader-account-cli'});console.log('Usuario autorizado creado: '+user.id);
}else{await authorizeLeaderAccount(db,{userId:value('user'),personId,enabled:!disabled});console.log(disabled?'Acceso al Portal Líder retirado. Otros roles conservados.':'Usuario vinculado y autorizado. El alcance depende del liderazgo vigente.');}
}finally{await db.end();}
