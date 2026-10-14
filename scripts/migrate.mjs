import {readConfig} from '../server/core/config.mjs';
import {createPool} from '../server/db/pool.mjs';
import {migrate} from '../server/db/migrate.mjs';
const config=readConfig();
const pool=createPool({...config,databaseUrl:process.env.MIGRATION_DATABASE_URL || config.databaseUrl});
try{await migrate(pool);console.log('Migraciones PostgreSQL aplicadas.');}finally{await pool.end();}
