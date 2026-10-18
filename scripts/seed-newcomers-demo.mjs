import {createPool} from '../server/db/pool.mjs';
import {seedNewcomersDemo} from '../server/newcomers/demo.mjs';
if(process.env.APP_ENV!=='demo'||process.env.ALLOW_NEWCOMERS_DEMO_SEED!=='true')throw new Error('Habilitá explícitamente el seed 1.7 en DEMO.');
const pool=createPool({databaseUrl:process.env.MIGRATION_DATABASE_URL,dbSsl:process.env.DB_SSL==='true'}),lock=await pool.connect();
try{await lock.query('SELECT pg_advisory_lock(505002)');console.log(await seedNewcomersDemo(pool,{demo:true}));}
catch(error){console.error(JSON.stringify({event:'newcomers_demo_seed_failed',code:error.code||'SEED_ERROR'}));process.exitCode=1;}
finally{await lock.query('SELECT pg_advisory_unlock(505002)');lock.release();await pool.end();}
