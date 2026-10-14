import {grantRuntime} from '../server/db/runtime-grants.mjs';
import {createPool} from '../server/db/pool.mjs';
import {readConfig} from '../server/core/config.mjs';
if(process.env.NODE_ENV==='production')throw new Error('Este comando solo configura el rol local erp_app.');
const pool=createPool({...readConfig(),databaseUrl:process.env.MIGRATION_DATABASE_URL});
try{
 await grantRuntime(pool,'erp_app');
 console.log('Privilegios mínimos aplicados al rol local erp_app.');
}finally{await pool.end();}
