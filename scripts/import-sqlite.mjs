// The only SQLite dependency left: an explicit, read-only, one-time conversion tool.
import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {readConfig} from '../server/core/config.mjs';
import {createPool,transaction} from '../server/db/pool.mjs';
import {appendAudit} from '../server/audit/repository.mjs';
export async function importSqlite(pool,filename) {
 const legacy=new DatabaseSync(filename,{readOnly:true});
 let source;
 try{source={people:legacy.prepare('SELECT * FROM people ORDER BY id').all(),events:legacy.prepare('SELECT * FROM person_events ORDER BY rowid').all(),audit:legacy.prepare('SELECT * FROM person_audit_changes ORDER BY rowid').all()};}finally{legacy.close();}
 const digest=createHash('sha256').update(JSON.stringify(source)).digest('hex');
 return transaction(pool,async client=>{
  await client.query('SELECT pg_advisory_xact_lock(404002)');
  if((await client.query('SELECT 1 FROM legacy_imports WHERE source_digest=$1',[digest])).rowCount)return {alreadyImported:true};
  if(Number((await client.query('SELECT count(*) AS n FROM people')).rows[0].n))throw new Error('La importación exige una tabla Personas vacía para evitar sobrescrituras.');
  const allowed=['id','names','lastNames','document','documentKey','birthDate','sex','phone','alternatePhone','email','address','locality','municipality','province','postalCode','joinedDate','status','notes','profileImageKey','latitude','longitude','geocodedAt','nameKey','phoneKey','localityKey','searchText','sortName','createdAt','updatedAt','version'];
  for(const person of source.people)await client.query(`INSERT INTO people(${allowed.map(key=>`"${key}"`).join(',')}) VALUES(${allowed.map((_,i)=>`$${i+1}`).join(',')})`,allowed.map(key=>key==='sex'?({MASCULINO:'HOMBRE',FEMENINO:'MUJER',HOMBRE:'HOMBRE',MUJER:'MUJER'}[person.sex]||null):person[key]??null));
  for(const event of source.events)await client.query('INSERT INTO person_events(id,"personId",type,source,summary,"actorId","occurredAt") VALUES($1,$2,$3,$4,$5,$6,$7)',[event.id,event.personId,event.type,event.source,event.summary,event.actorId,event.occurredAt]);
  for(const event of source.audit)await appendAudit(client,{id:event.id,actorId:event.actorId,action:source.events.some(item=>item.personId===event.personId&&item.type==='person.created'&&item.occurredAt===event.occurredAt)?'PERSON_CREATE':'PERSON_UPDATE',entity:'PERSON',entityId:event.personId,occurredAt:event.occurredAt,changes:JSON.parse(event.changes),context:{source:'sqlite-1.1'}});
  const counts={people:source.people.length,events:source.events.length,audit:source.audit.length};
  await client.query('INSERT INTO legacy_imports(source_digest,counts) VALUES($1,$2)',[digest,JSON.stringify(counts)]);return counts;
 });
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)) {
 const config=readConfig(),pool=createPool({...config,databaseUrl:process.env.MIGRATION_DATABASE_URL || config.databaseUrl});
 try{const result=await importSqlite(pool,resolve(process.argv[2] || 'data/erp.sqlite'));console.log('Importación PostgreSQL verificada:',result);}finally{await pool.end();}
}
