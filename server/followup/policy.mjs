// Change here, then run followup:rebuild to reconcile existing history.
export const absencePolicy=Object.freeze({attention:3,urgent:6,window:8});
export function calculate(rows,policy=absencePolicy){
 if(!Number.isInteger(policy.attention)||policy.attention<1||policy.urgent<=policy.attention||policy.window<1)throw new Error('Invalid absence policy');
 let streak=0,lastPresent=null,run=[];const episodes=[];
 for(const row of rows){if(row.status==='PRESENT'){if(run.length>=policy.attention)episodes.push({rows:run,active:false});run=[];streak=0;lastPresent=row.date;}else if(row.status==='ABSENT'){run.push(row);streak++;}}
 if(run.length>=policy.attention)episodes.push({rows:run,active:true});
 return {streak,last8:rows.slice(-policy.window).filter(r=>r.status==='ABSENT').length,valid_count:rows.length,level:streak>=policy.urgent?'URGENT':streak>=policy.attention?'ATTENTION':'REGULAR',last_present:lastPresent,last_valid:rows.at(-1)?.date||null,episodes};
}
