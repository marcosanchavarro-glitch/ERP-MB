import {readConfig} from '../server/core/config.mjs';
import {createPool} from '../server/db/pool.mjs';
import {migrate} from '../server/db/migrate.mjs';
const config=readConfig(),url=new URL(process.env.MIGRATION_DATABASE_URL || '');
if(config.mode!=='development'||!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!=='/erp'||!process.argv.includes('--confirm-delete-local-data'))throw new Error('Reset solo para erp local en desarrollo y con --confirm-delete-local-data.');
const pool=createPool({...config,databaseUrl:url.href});
try{await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');await migrate(pool);console.log('Base local reiniciada. Volvé a ejecutar db:grant-local, admin:create y opcionalmente db:seed.');}finally{await pool.end();}
