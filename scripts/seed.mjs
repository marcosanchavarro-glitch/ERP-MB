import {readConfig} from '../server/core/config.mjs';
import {createPool} from '../server/db/pool.mjs';
import {createPeopleService} from '../server/people/service.mjs';
import {seedDemo} from '../server/demo.mjs';
const config=readConfig();if(config.production)throw new Error('Los datos demo están prohibidos en producción.');
const pool=createPool(config);try{await seedDemo(createPeopleService(pool));console.log('Seed demo completado sin reemplazar datos existentes.');}finally{await pool.end();}
