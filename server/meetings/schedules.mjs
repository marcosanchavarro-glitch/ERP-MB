import {randomUUID} from 'node:crypto';
import {weekStart,addDays,onWeek} from '../../src/domain/meeting.js';
import {today} from '../../src/domain/cell.js';
import {appendAudit} from '../audit/repository.mjs';
import {event} from './repository.mjs';
// The caller owns the transaction and already locks the cell before changing it.
export async function scheduleChanged(db,old,cell,ctx){
 if(old&&old.meetingDay===cell.meetingDay&&old.meetingTime===cell.meetingTime)return;
 const effectiveWeek=old?addDays(weekStart(),7):weekStart(cell.openedDate||today()),id=randomUUID();
 await db.query('INSERT INTO cell_schedules(id,"cellId","effectiveWeek",day,time,"actorId") VALUES($1,$2,$3,$4,$5,$6)',[id,cell.id,effectiveWeek,cell.meetingDay,cell.meetingTime,ctx.user.id]);
 await appendAudit(db,{actorId:ctx.user.id,action:'CELL_SCHEDULE',entity:'CELL',entityId:cell.id,changes:[{field:'schedule',before:old?{day:old.meetingDay,time:old.meetingTime}:null,after:{day:cell.meetingDay,time:cell.meetingTime,effectiveWeek}}],context:{requestId:ctx.requestId}});
 const future=(await db.query("SELECT * FROM cell_meetings WHERE \"cellId\"=$1 AND week>=$2 AND status='SCHEDULED' ORDER BY id FOR UPDATE",[cell.id,effectiveWeek])).rows;
 for(const m of future){
  if(cell.meetingDay!=null&&cell.meetingTime){const date=onWeek(m.week,cell.meetingDay);await db.query('UPDATE cell_meetings SET date=$2,time=$3,"scheduleId"=$4,version=version+1,"updatedAt"=now(),"updatedBy"=$5 WHERE id=$1',[m.id,date,cell.meetingTime,id,ctx.user.id]);await event(db,m,'RESCHEDULE',ctx,[{field:'schedule',before:{date:m.date,time:m.time},after:{date,time:cell.meetingTime}}]);}
  else {const reason='Configuración semanal retirada a partir de '+effectiveWeek;await db.query('UPDATE cell_meetings SET status=\'CANCELLED\',"cancellationReason"=$2,version=version+1,"updatedAt"=now(),"updatedBy"=$3 WHERE id=$1',[m.id,reason,ctx.user.id]);await event(db,m,'CANCEL',ctx,[{field:'status',before:m.status,after:'CANCELLED'}],reason);}
 }
}
export async function cellClosed(db,id,date,ctx){const rows=(await db.query('UPDATE cell_meetings SET status=\'CANCELLED\',"cancellationReason"=\'Cierre de la célula\',version=version+1,"updatedAt"=now(),"updatedBy"=$3 WHERE "cellId"=$1 AND date>=$2 AND status=\'SCHEDULED\' RETURNING *',[id,date,ctx.user.id])).rows;for(const m of rows)await event(db,m,'CANCEL',ctx,[{field:'status',before:'SCHEDULED',after:'CANCELLED'}],'Cierre de la célula');}
