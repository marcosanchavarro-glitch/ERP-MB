import EmbeddedPostgres from 'embedded-postgres';
import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
const root=resolve(import.meta.dirname,'..'),privateDir=resolve(root,'.local');
if(process.env.NODE_ENV==='production')throw new Error('PostgreSQL portable solo se permite en desarrollo.');
await mkdir(privateDir,{recursive:true});
let credentials;
try{credentials=JSON.parse(await readFile(resolve(privateDir,'postgres.json'),'utf8'));}
catch(error){if(error.code!=='ENOENT')throw error;credentials={owner:randomBytes(32).toString('hex'),app:randomBytes(32).toString('hex'),port:55432};await writeFile(resolve(privateDir,'postgres.json'),JSON.stringify(credentials),{mode:0o600,flag:'wx'});}
const directory=resolve(privateDir,'postgres');
const postgres=new EmbeddedPostgres({databaseDir:directory,user:'erp_owner',password:credentials.owner,port:credentials.port,persistent:true,authMethod:'scram-sha-256',initdbFlags:['--encoding=UTF8','--locale=C'],postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
try{await access(resolve(directory,'PG_VERSION'));}catch{await postgres.initialise();}
await postgres.start();
const ownerUrl=`postgresql://erp_owner:${credentials.owner}@127.0.0.1:${credentials.port}/erp`;
const admin=new pg.Client({connectionString:ownerUrl.replace(/\/erp$/,'/postgres')});await admin.connect();
if(!(await admin.query("SELECT 1 FROM pg_database WHERE datname='erp'")).rowCount)await admin.query('CREATE DATABASE erp');
// Identifiers are fixed; generated passwords are hex, never provided by user input.
if(!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='erp_app'")).rowCount)await admin.query(`CREATE ROLE erp_app LOGIN PASSWORD '${credentials.app}'`);
await admin.end();
try{await writeFile(resolve(root,'.env'),`NODE_ENV=development\nPORT=5173\nAPP_ORIGIN=http://127.0.0.1:5173\nDATABASE_URL=postgresql://erp_app:${credentials.app}@127.0.0.1:${credentials.port}/erp\nMIGRATION_DATABASE_URL=${ownerUrl}\nSESSION_SECRET=${randomBytes(48).toString('hex')}\n`,{flag:'wx',mode:0o600});}catch(error){if(error.code!=='EEXIST')throw error;}
console.log('PostgreSQL local disponible en 127.0.0.1:55432. Configuración privada en .env. Ctrl+C para detener.');
const stop=async()=>{await postgres.stop();process.exit(0);};process.on('SIGINT',stop);process.on('SIGTERM',stop);
await new Promise(()=>{});
