import {createPool} from '../server/db/pool.mjs';
import {readConfig} from '../server/core/config.mjs';
import {revokeUserSessions,deactivateUser} from '../server/identity/service.mjs';
const id=process.argv[2];if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || ''))throw new Error('Indicá el UUID del usuario.');
const config=readConfig(),pool=createPool({...config,databaseUrl:process.env.MIGRATION_DATABASE_URL || config.databaseUrl});
try{if(process.argv.includes('--deactivate'))await deactivateUser(pool,id);else await revokeUserSessions(pool,id);console.log('Sesiones revocadas.');}finally{await pool.end();}
