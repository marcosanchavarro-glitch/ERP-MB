// Presentation only: the caller supplies the already-authorized navigation.
export const officeGroups=Object.freeze([
 {id:'daily',name:'Trabajo diario',ids:['oficina-trabajo','oficina-asistencia','oficina-seguimiento','oficina-citas','oficina-dashboard']},
 {id:'community',name:'Comunidad',ids:['oficina-personas','oficina-celulas','oficina-nuevos','oficina-cumpleanos']},
 {id:'fundamentals',name:'Datos fundamentales',ids:['oficina-cargos','oficina-areas']},
 {id:'data',name:'Datos y revisión',ids:['oficina-calidad','oficina-importar-exportar','oficina-auditoria']}
]);
export function officeNavigationGroups(children){
 const used=new Set(),groups=officeGroups.map(group=>({...group,items:group.ids.flatMap(id=>{const item=children.find(c=>c.id===id);if(!item||used.has(id))return [];used.add(id);return [item];})})).filter(g=>g.items.length);
 const other=children.filter(c=>!used.has(c.id));if(other.length)groups.push({id:'other',name:'Otras herramientas',items:other});return groups;
}
export const sectionDescriptions=Object.freeze({
 'oficina-areas':'Consultá áreas, departamentos y responsabilidades organizativas.',
 'oficina-cargos':'Consultá la jerarquía y los cargos vigentes registrados.',
 'oficina-trabajo':'Organizá los contactos y pendientes que necesitan atención hoy.',
 'oficina-dashboard':'Identificá pendientes y accedé a las tareas prioritarias de Oficina.',
 'oficina-personas':'Consultá y mantené las fichas de la comunidad.',
 'oficina-celulas':'Consultá las células, sus responsables y sus integrantes.',
 'oficina-asistencia':'Registrá y revisá la asistencia de las reuniones de células.',
 'oficina-seguimiento':'Organizá el acompañamiento de los casos abiertos.',
 'oficina-nuevos':'Acompañá a quienes se acercan a la comunidad durante su integración.',
 'oficina-citas':'Organizá las citas y consultá la agenda de atención.',
 'oficina-cumpleanos':'Consultá las próximas fechas y abrí la ficha de cada persona.',
 'oficina-calidad':'Revisá datos pendientes e inconsistencias antes de corregirlos.',
 'oficina-importar-exportar':'Prepará y revisá la incorporación de datos a la Matriz.',
 'territorio-mapa':'Visualizá las sedes, las células y sus lugares de reunión.',
 'territorio-analisis':'Consultá la distribución de células y la presencia territorial registrada.',
 'territorio-evangelismo':'Planificá salidas y consultá actividades y recorridos registrados.'
});
