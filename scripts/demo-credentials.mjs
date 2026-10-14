import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {demoAccounts,demoPassword} from '../server/demo-deployment.mjs';
// Local operator artifact. Never log values or overwrite credentials from an existing deployment.
const bootstrap=randomBytes(48).toString('hex'),runtime=randomBytes(48).toString('hex');
await mkdir('.local',{recursive:true});
await writeFile('.local/render-demo-credentials.json',JSON.stringify({SESSION_SECRET:randomBytes(48).toString('hex'),RUNTIME_DB_PASSWORD:runtime,DEMO_BOOTSTRAP_SECRET:bootstrap,accounts:demoAccounts.map(([key,profile])=>({username:'demo.'+key,password:demoPassword(bootstrap,'demo.'+key),profile}))},null,2),{flag:'wx',mode:0o600});
console.log('Credenciales generadas en .local/render-demo-credentials.json (excluido de Git). No compartir públicamente.');
