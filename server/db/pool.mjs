import pg from 'pg';
import {flushEvaluation} from '../followup/evaluator.mjs';
import {readFileSync} from 'node:fs';
pg.types.setTypeParser(1082,value=>value);
pg.types.setTypeParser(1184,value=>new Date(value).toISOString());
export function createPool(config) {
 return new pg.Pool({connectionString:config.databaseUrl,max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,statement_timeout:10000,
  ssl:config.dbSsl?{rejectUnauthorized:true,...(config.dbCa?{ca:readFileSync(config.dbCa,'utf8')}:{})}:undefined});
}
export async function transaction(pool,callback) {
 const client=await pool.connect();
 try {await client.query('BEGIN');const result=await callback(client);await flushEvaluation(client);await client.query('COMMIT');return result;}
 catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
