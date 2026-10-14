import {randomUUID} from 'node:crypto';
import {fields,fieldGroups,validatePerson,normalizeText,normalizeDocument,normalizePhone,fullName} from '../../src/domain/person.js';
import {DomainError} from '../core/errors.mjs';
import {transaction} from '../db/pool.mjs';
import {appendAudit} from '../audit/repository.mjs';
import {getPerson,listPeople,localities,history,lockName,documentExists,nameMatches,persistPerson,appendPersonEvents} from './repository.mjs';
export function createPeopleService(pool) {
 async function save(input,{id=null,version,actorId,acknowledgeDuplicates=false,readScope={all:true},requestId,client:externalClient}={}) {
  if(!actorId)throw new Error('Explicit actor required');
  const {person,errors}=validatePerson(input);
  if(Object.keys(errors).length)throw new DomainError(422,'Revisá los campos indicados.',{fields:errors});
  const derived={documentKey:normalizeDocument(person.document)||null,nameKey:normalizeText(fullName(person)),phoneKey:normalizePhone(person.phone),localityKey:normalizeText(person.locality),sortName:normalizeText(`${person.lastNames} ${person.names}`)};
  derived.searchText=normalizeText([person.names,person.lastNames,person.document,derived.documentKey,person.phone,derived.phoneKey].filter(Boolean).join(' '));
  try {const execute=async client=>{
   // Serialize equal-name creations so a concurrent request cannot bypass the warning.
   await lockName(client,derived.nameKey);
   const old=id?await getPerson(client,id,{lock:true}):null;
   if(old&&old.version!==version)throw new DomainError(409,'Otra edición actualizó esta ficha. Tus cambios siguen en el formulario; revisá la versión actual antes de volver a guardar.',{code:'VERSION_CONFLICT'});
   if(await documentExists(client,derived.documentKey,id))throw new DomainError(409,'Ya existe una persona con ese documento.',{fields:{document:'Este documento ya está registrado.'},code:'DUPLICATE_DOCUMENT'});
   const possible=await nameMatches(client,derived.nameKey,id,readScope);
   if(possible.length&&!acknowledgeDuplicates&&(!old||derived.nameKey!==normalizeText(fullName(old))))throw new DomainError(409,'Encontramos personas con el mismo nombre y apellido. Revisá sus fichas antes de continuar.',{code:'POSSIBLE_DUPLICATE',matches:possible});
   const changes=fields.filter(field=>!old||old[field.key]!==person[field.key]).map(({key})=>({field:key,before:old?.[key]??null,after:person[key]}));
   if(old&&!changes.length)return old;
   const now=new Date().toISOString(),personId=id||randomUUID();
   const stored={...person,...derived,updatedAt:now};
   await persistPerson(client,personId,stored,Boolean(old),now);
   await appendAudit(client,{actorId,action:old?'PERSON_UPDATE':'PERSON_CREATE',entity:'PERSON',entityId:personId,changes,occurredAt:now,context:requestId?{requestId}:{}});
   const events=[];
   if(!old)events.push(['person.created','Persona creada.']);
   else{
    const descriptions={personal:'Datos personales modificados.',contact:'Datos de contacto modificados.',address:'Domicilio modificado.',administrative:'Información administrativa modificada.'};
    for(const group of fieldGroups)if(changes.some(change=>change.field!=='status'&&group.fields.some(field=>field.key===change.field)))events.push([`person.${group.id}.updated`,descriptions[group.id]]);
    if(changes.some(change=>change.field==='status'))events.push(['person.status.changed',`Estado actualizado a ${person.status==='ACTIVA'?'activa':'inactiva'}.`]);
   }
   await appendPersonEvents(client,personId,events,actorId,now);
   return getPerson(client,personId);
  };return externalClient?await execute(externalClient):await transaction(pool,execute);}catch(error){if(error.code==='23505')throw new DomainError(409,'Ya existe una persona con ese documento.',{code:'DUPLICATE_DOCUMENT',fields:{document:'Este documento ya está registrado.'}});throw error;}
 }
 return {get:id=>getPerson(pool,id),list:(query,scope)=>listPeople(pool,query,scope),save,history:(id,page)=>history(pool,id,page),localities:scope=>localities(pool,scope)};
}
