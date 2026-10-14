import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {readConfig} from '../server/core/config.mjs';
import {createPool} from '../server/db/pool.mjs';
import {createUser,adminRole} from '../server/identity/service.mjs';
const config=readConfig(),args=process.argv.slice(2);
const username=args.find(value=>value.startsWith('--username='))?.slice(11) || (config.production?null:'admin.desarrollo');
if(!username)throw new Error('Indicá --username=cuenta.');
const stdin=args.includes('--password-stdin');
if(config.production&&!stdin)throw new Error('En producción se requiere --password-stdin.');
let password;
if(stdin){const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);password=Buffer.concat(chunks).toString('utf8').replace(/[\r\n]+$/,'');}
else password=randomBytes(24).toString('base64url');
const pool=createPool({...config,databaseUrl:process.env.MIGRATION_DATABASE_URL || config.databaseUrl});
try{
 const roleId=await adminRole(pool);await createUser(pool,{username,password,grants:[{roleId,scopeType:'global'}]});
 if(!stdin){const dir=resolve(import.meta.dirname,'../.local');await mkdir(dir,{recursive:true});await writeFile(resolve(dir,'admin-credentials.txt'),`Cuenta administrativa SOLO de desarrollo\nUsuario: ${username}\nContraseña: ${password}\n`,{mode:0o600});console.log('Administrador creado. Credenciales aleatorias en .local/admin-credentials.txt (excluido de Git).');}
 else console.log('Administrador creado.');
}catch(error){if(error.code==='23505')throw new Error('La cuenta ya existe. No se cambió su contraseña.');throw error;}finally{await pool.end();}
