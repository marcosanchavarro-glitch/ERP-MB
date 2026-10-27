export const departmentStates={SCHEDULED:'Programada',IN_PROGRESS:'En curso',COMPLETED:'Finalizada',CANCELLED:'Cancelada'};
export const departmentTransitions={SCHEDULED:['IN_PROGRESS','CANCELLED'],IN_PROGRESS:['COMPLETED','CANCELLED'],COMPLETED:[],CANCELLED:[]};
export const departmentActivityFields=['title','description','date','time','venue','responsibleId','notes'];
