import {readConfig} from '../server/core/config.mjs';
import {createPool,transaction} from '../server/db/pool.mjs';
import {evaluate} from '../server/followup/evaluator.mjs';
const db=createPool(readConfig());let cursor='00000000-0000-0000-0000-000000000000',count=0;
try{while(true){const ids=(await db.query('SELECT id FROM people WHERE id>$1 ORDER BY id LIMIT 100',[cursor])).rows.map(p=>p.id);if(!ids.length)break;await transaction(db,client=>evaluate(client,ids));count+=ids.length;cursor=ids.at(-1);}console.log(`Seguimiento reconciliado: ${count} personas revisadas.`);}finally{await db.end();}
