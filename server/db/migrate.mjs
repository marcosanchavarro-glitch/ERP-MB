import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
export async function migrate(pool) {
 const client=await pool.connect();
 try {
  await client.query('SELECT pg_advisory_lock(404001)');
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  const directory=resolve(import.meta.dirname,'migrations');
  for(const name of (await readdir(directory)).filter(name=>name.endsWith('.sql')).sort()) {
   const sql=await readFile(resolve(directory,name),'utf8');const checksum=createHash('sha256').update(sql).digest('hex');
   const prior=(await client.query('SELECT checksum FROM schema_migrations WHERE name=$1',[name])).rows[0];
   if(prior){if(prior.checksum!==checksum)throw new Error(`Migración modificada: ${name}`);continue;}
   await client.query('BEGIN');
   try {await client.query(sql);await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',[name,checksum]);await client.query('COMMIT');}
   catch(error){await client.query('ROLLBACK');throw error;}
  }
 }finally{await client.query('SELECT pg_advisory_unlock(404001)');client.release();}
}
