// Allow-list, not redaction: raw errors, bodies, URLs, queries and headers never enter logs.
const keys=['requestId','method','route','status','durationMs','actorId','action','entity','entityId','code'];
export function logRecord(level,event,context={}) {
 const safe=Object.fromEntries(keys.filter(key=>context[key]!==undefined).map(key=>[key,String(context[key]).slice(0,120)]));
 return {time:new Date().toISOString(),level,event,...safe};
}
export function log(level,event,context={}) {process.stdout.write(JSON.stringify(logRecord(level,event,context))+'\n');}
