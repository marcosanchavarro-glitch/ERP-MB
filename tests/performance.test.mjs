import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
test('Matriz con 20.000 registros: filtros/paginación en PostgreSQL e índice trigram',async t=>{
 const f=await fixture();t.after(()=>f.close());
 await f.pool.query(`INSERT INTO people(id,names,"lastNames",status,"nameKey","phoneKey","localityKey","searchText","sortName","createdAt","updatedAt")
 SELECT gen_random_uuid(),'Demo','Prueba '||n,CASE WHEN n%2=0 THEN 'ACTIVA' ELSE 'INACTIVA' END,'demo prueba '||n,'000'||n,'localidad demo',
 CASE WHEN n=12345 THEN 'demo coincidenciaespecial prueba' ELSE 'demo prueba '||n END,'prueba '||lpad(n::text,5,'0'),now(),now() FROM generate_series(1,20000) n`);
 // Flush the GIN pending list after the bulk fixture load, as autovacuum does in service.
 await f.pool.query('VACUUM (ANALYZE) people');
 const start=performance.now();const result=await f.people.list({status:'ACTIVA',page:300,pageSize:20});const elapsed=performance.now()-start;
 assert.equal(result.total,10000);assert.equal(result.items.length,20);assert.equal(result.page,300);
 assert.equal((await f.people.list({q:'coincidenciaespecial'})).total,1);
 const plan=await f.pool.query('EXPLAIN (FORMAT JSON) SELECT id FROM people WHERE "searchText" LIKE $1',['%coincidenciaespecial%']);
 assert.match(JSON.stringify(plan.rows),/people_search/);
 t.diagnostic(`Filtro/página 300 sobre 20.000 registros: ${elapsed.toFixed(1)} ms en este equipo (no es un SLA ni una prueba de carga concurrente).`);
});
