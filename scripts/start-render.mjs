import {createPool} from '../server/db/pool.mjs';
import {migrate} from '../server/db/migrate.mjs';
import {grantRuntime} from '../server/db/runtime-grants.mjs';
import {seedDeploymentDemo} from '../server/demo-deployment.mjs';
import {readConfig} from '../server/core/config.mjs';
// This bootstrap is intentionally DEMO-only. Local and future production keep their own commands.
try{
 if(process.env.APP_ENV!=='demo'||process.env.NODE_ENV!=='production')throw new Error('Invalid deployment environment');
 const ownerUrl=new URL(process.env.MIGRATION_DATABASE_URL);
 if(['localhost','127.0.0.1','::1'].includes(ownerUrl.hostname)||!ownerUrl.pathname.includes('demo'))throw new Error('Independent demo database required');
 const password=process.env.RUNTIME_DB_PASSWORD;
 if(!/^[a-f0-9]{96}$/.test(password||''))throw new Error('Runtime password missing');
 const role='erp_demo_app',runtimeUrl=new URL(ownerUrl);runtimeUrl.username=role;runtimeUrl.password=password;
 process.env.DATABASE_URL=runtimeUrl.href;
 const config=readConfig(),pool=createPool({...config,databaseUrl:ownerUrl.href});
 const lock=await pool.connect();
 try{
  await lock.query('SELECT pg_advisory_lock(505002)');
  await migrate(pool);
  if(!(await pool.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount){
   const sql=(await pool.query("SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT', $1::text,$2::text) sql",[role,password])).rows[0].sql;
   await pool.query(sql);
  }
  await grantRuntime(pool,role);
  if(process.env.ALLOW_DEMO_SEED==='true')await seedDeploymentDemo(pool,process.env);
 }finally{await lock.query('SELECT pg_advisory_unlock(505002)');lock.release();await pool.end();}
 delete process.env.MIGRATION_DATABASE_URL;delete process.env.RUNTIME_DB_PASSWORD;delete process.env.DEMO_BOOTSTRAP_SECRET;
 await import('./serve.mjs');
}catch{console.error('Inicio DEMO fallido. Revisar configuración, conexión y migraciones con el operador; no se abrió tráfico.');process.exitCode=1;}
