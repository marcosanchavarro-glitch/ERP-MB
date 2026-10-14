import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const patterns=[/postgres(?:ql)?:\/\/[^\s"'`]+:[^\s"'`$]+@/g,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,/\b(?:SESSION_SECRET|ADMIN_PASSWORD|DATABASE_URL)\s*=\s*["']?[a-zA-Z0-9+/=_-]{24,}/g];
const flagged=[];
for(const file of files){if(file==='package-lock.json')continue;let data;try{data=readFileSync(file,'utf8');}catch{continue;}if(patterns.some(pattern=>{pattern.lastIndex=0;return pattern.test(data);}))flagged.push(file);}
if(flagged.length){console.error('Revisar posibles secretos en archivos: '+flagged.join(', '));process.exitCode=1;}else console.log('Sin patrones de secretos en los archivos candidatos a Git. Revisión heurística, no garantía absoluta.');
