# Subfase 1.5 — Inasistencias, alertas y seguimiento

Implementación local: 13 de octubre de 2026. Acceso: **Oficina → Seguimiento**. No crea otra base de Personas ni modifica su pertenencia por una inasistencia.

## Informe de entrega

1. **Estado previo.** Se inspeccionaron reuniones, snapshots, acciones transaccionales, membresías temporales, Portal Líder, Ficha 360°, autorización y auditoría. Antes de modificar: 69/69 pruebas Node y 7/7 suites de navegador aprobadas. Evidencia: `test-results/15-baseline-node.log` y `15-baseline-browser.log`.
2. **Alertas.** `followup_alerts` conserva UUID, Persona, episodio, célula donde alcanzó Atención, fecha de umbral, nivel, estado, reuniones involucradas y resolución. Una alerta representa una racha; las ausencias cuarta y quinta actualizan esa misma alerta. La fuente de verdad sigue siendo la asistencia.
3. **Casos.** `followup_cases` referencia la Persona única y la célula de apertura, con motivo, nivel, origen automático/manual, estado, responsable opcional, observaciones internas, apertura, última acción, cierre, resultado, timestamps y versión. `followup_interventions` guarda fecha, Persona responsable, tipo, nota, resultado y Usuario actor. No duplica nombres como identidad del responsable.
4. **Umbrales.** Centralizados en `server/followup/policy.mjs`: Atención 3, Urgente 6, ventana 8. Cambiar la política requiere reconciliar con `npm run followup:rebuild`; no reescribir el algoritmo. No se construyó un editor administrativo de políticas.
5. **Racha.** Se ordenan registros válidos de la Persona por fecha, hora y UUID de reunión. Solo se consideran reuniones CARGADAS/CERRADAS ya ocurridas, con marca explícita PRESENTE/AUSENTE y pertenencia temporal válida en esa célula. Una presencia reinicia la racha; pendientes, futuras, canceladas y semanas sin registro válido se omiten: no suman ni cortan artificialmente la racha. Los períodos son `[inicio, fin)`, como en 1.3.
6. **Últimas ocho.** Cuenta AUSENTE entre las últimas ocho reuniones válidas, o las disponibles si hay menos. Es independiente de la racha y no dispara alertas. Oficina muestra ambas métricas y la última presencia registrada.
7. **Evaluación.** Triggers de asistencia, reunión y membresía registran las Personas afectadas en `followup_dirty`, separadas por transacción. La unidad de trabajo existente evalúa esos IDs antes del COMMIT. Asistencia, métricas, alertas, casos y auditoría confirman juntos o se revierten juntos. No depende de abrir Seguimiento. No se duplicó el guardado de asistencia: Oficina y Portal siguen usando el servicio 1.3.
8. **Idempotencia.** Clave única Persona/episodio en alertas; vínculo persistente alerta/caso; índice parcial de un único caso ABIERTO/EN_SEGUIMIENTO por Persona. Repetir la evaluación no agrega alertas, casos ni eventos iguales. Episodios nuevos pueden incorporarse a un caso activo compatible. Una vez asociados, cerrar ese caso no provoca que reaparezca automáticamente por la misma historia.
9. **Correcciones.** Se vuelve a recorrer la historia válida de las Personas afectadas. Se actualizan métricas y alertas; las alertas que dejan de corresponder se conservan como resueltas por recálculo. El evento registra el cambio. Un caso administrativo no se elimina ni se cierra automáticamente por una corrección.
10. **Cancelaciones.** Al cancelar una reunión cargada, el servicio 1.3 conserva eventos y retira sus marcas. El evaluador la excluye en esa misma transacción. La reapertura y los cambios relevantes también invalidan el cálculo; el cierre de una reunión no duplica sus consecuencias.
11. **Transferencias y cierre de célula.** Oficina calcula la secuencia cronológica entre células, verificando los períodos históricos. Cada reunión conserva su célula real, visible en el detalle de la alerta. El caso mantiene la célula con la que se abrió y muestra también la célula actual de la Persona. Cerrar la célula no borra el caso ni impide a Oficina administrarlo.
12. **Regularización.** Una presencia posterior deja la racha en cero y el estado calculado en REGULAR. La interfaz sugiere revisar el caso, que continúa abierto. REGULARIZAR y CERRAR son acciones explícitas con resultado obligatorio, versión, fecha y actor. REGULARIZADO deja de ser un caso activo; puede cerrarse después. Los contactos llevan de ABIERTO a EN_SEGUIMIENTO.
13. **Recurrencias.** Una racha posterior a una presencia constituye otro episodio. Puede crear un caso nuevo cuando alcanza Urgente si el anterior ya está regularizado/cerrado. Se conserva la relación con los episodios y casos anteriores; no se reutiliza eternamente un caso cerrado.
14. **Ficha 360°.** Seguimiento abre la ficha contextual de Persona sin perder filtros ni página al cerrarla. La ficha incluye una sección Seguimiento, consultada mediante su propio permiso. También puede abrirse el caso desde allí. La sección de Asistencia anterior permanece disponible.
15. **Portal Líder.** El permiso explícito `lider.indicadores`, incluido en el rol Portal líder, permite ver racha y nivel simples en integrantes/ficha restringida. El servidor recalcula esa proyección usando únicamente reuniones de la célula actualmente autorizada; no expone la historia de otras células. Por eso la racha del portal puede diferir del total cronológico que ve Oficina después de una transferencia. El permiso puede retirarse de un rol sin retirar el portal.
16. **Privacidad.** El portal nunca recibe notas de Oficina, intervenciones, casos completos, responsables internos ni auditoría. Las respuestas tienen una proyección permitida `{streak, level}`. Las APIs administrativas rechazan cuentas exclusivamente líderes aunque manipulen URLs o UUID.
17. **Autorización.** `seguimiento.ver` y `seguimiento.gestionar` admiten alcance global o por Persona. El rol Oficina administrativa los recibe; otros roles necesitan concesión explícita. La consulta exige ver; mutaciones exigen ver y gestionar sobre la Persona del caso. Abrir Ficha 360° o seleccionar un responsable requiere el permiso existente `personas.ver`. Conocer un UUID no otorga acceso. Se conserva CSRF y validación autoritativa.
18. **Auditoría y eventos.** Apertura, escalamiento, asociación de episodios, asignación, contacto, notas, regularización y cierre producen auditoría. Los eventos automáticos usan `system:absence-evaluator`; las acciones humanas usan el Usuario de sesión. La acción original de asistencia mantiene además su auditoría con Usuario real. `followup_events` e intervenciones son append-only; alertas y casos no se eliminan. Los eventos internos permiten agregar una futura entrega de notificaciones, sin enviar nada externamente ahora.
19. **Concurrencia.** El evaluador bloquea Personas en orden estable antes de calcular. Se conserva el orden de bloqueos celular existente y se usan índices únicos como segunda defensa. Las acciones administrativas bloquean Persona/caso y requieren versión vigente. Un conflicto rechaza la segunda escritura; no sobrescribe notas ni duplica un caso.
20. **Índices y rendimiento.** Se reutiliza `attendance_person_history` y los índices temporales de membresía. Se agregan índices de métricas/nivel, casos por Persona/responsable, alertas, eventos e intervenciones. El panel consulta una caché derivada y pagina en SQL, 50 Personas por página. No recorre toda la asistencia al abrir el panel. Cada escritura relevante reconstruye solo la historia de las Personas afectadas; no procesa Personas sin marcas ni métricas previas. Detalles e historia paginan a 20. No se midió un SLA de carga productiva; casos muy grandes requieren medir tiempos antes de desplegar.
21. **Migración.** Nueva `007_followup.sql`, sin editar migraciones anteriores. Agrega tablas, índices, invalidación y permisos; no altera Personas ni membresías existentes. Para una instalación existente: detener aplicación, migrar, otorgar los privilegios nuevos, reconciliar historia y reiniciar. Instrucciones abajo. No agrega dependencias, servicios externos ni variables de entorno.
22. **Pruebas nuevas.** Catorce pruebas Node cubren umbrales 0–6, ventana independiente, idempotencia, regreso, pendientes/canceladas/futuras, correcciones, membresía histórica, transferencia, cierre celular, recurrencia, caso compatible, responsable/contacto, filtros, historia paginada, privacidad, permisos, IDOR, CSRF, concurrencia al sexto ausente y rollback ante fallo de auditoría. La nueva suite de navegador cubre panel, filtros, caso automático, Ficha 360°, asignación, contacto, líder restringido, regularización/cierre y 320/390/820/1440 px.
23. **Suite completa.** Resultado final: **83/83 pruebas Node y 8/8 suites de navegador aprobadas**, sin regresiones detectadas. Los casos anteriores permanecen; se actualizan únicamente las expectativas de migraciones y el estado disponible de Seguimiento. Resultados y capturas en `test-results/15-final-*.log` y `followup-*.png`.
24. **Deudas técnicas.** No hay editor de políticas ni notificaciones externas. La reconciliación es síncrona para garantizar consistencia; una cola asíncrona futura debe preservar esa garantía y mostrar su frescura. Cambios directos por SQL fuera de los servicios no son un flujo operativo admitido: requieren reconciliación explícita. No hay borradores persistentes/offline ni nuevo sistema de usuarios. Se mantienen los pendientes productivos de HTTPS, backups ensayados, monitoreo y carga documentados en Operación.

## Operación y reconciliación

Con la aplicación detenida:

```text
npm run db:migrate
npm run db:grant-local
npm run followup:rebuild
npm run dev
```

`db:grant-local` es específico del rol local `erp_app`. En otro entorno, aplicar sus privilegios equivalentes a las tablas nuevas: lectura/inserción/actualización de métricas, alertas y casos; lectura/inserción de eventos e intervenciones; lectura/inserción/eliminación de invalidaciones; uso de secuencias. No conceder actualización de auditoría.

`followup:rebuild` procesa páginas de 100 Personas, es repetible y usa los mismos bloqueos/evaluador. Útil para la instalación inicial, cambio de umbrales o una reparación autorizada. La primera reconciliación puede abrir casos sobre episodios urgentes históricos aunque hoy la Persona esté Regular: Oficina los revisa y regulariza, sin borrar el pasado.

Los snapshots de 1.3 permanecen intactos. El cálculo contrasta su pertenencia con los períodos históricos actuales: una finalización retroactiva puede excluir una marca posterior sin borrar aquella captura ni su auditoría. No convierte a integrantes nuevos en ausentes de reuniones que nunca los incluyeron.

## Uso y filtros

El panel ordena primero Urgente, luego Atención y Regular. Permite buscar Persona, filtrar estado, célula actual o de apertura, responsable del caso mostrado, con/sin caso y período de la última reunión válida. Los selectores buscan entidades existentes por nombre/código. Se muestra primero el caso activo y, si no lo hay, el más reciente. Los filtros se conservan al navegar y cerrar la ficha contextual durante la sesión de página.

Las intervenciones registran contactos ya realizados; seleccionar “Mensaje” no envía un mensaje. Los formularios conservan su contenido ante errores de red o sesión, y avisan antes de salir con cambios. No guardan datos privados en localStorage.

## Confirmaciones

- Pendiente no cuenta como ausencia; cancelada tampoco.
- Solo AUSENTE explícito en reunión válida y correspondiente a la Persona cuenta.
- No se duplican alertas por cuarta/quinta falta ni casos activos por la misma situación.
- Abrir seguimiento no mueve, elimina ni duplica a la Persona o su membresía.
- El regreso reinicia la racha, pero no borra alertas, casos ni historia.
- El líder no recibe notas internas ni amplía su alcance celular.
- No hay WhatsApp, email, push ni módulos externos nuevos.
- **No se avanzó a 1.6 ni a otra fase.**


Verificación local posterior: migración 007 aplicada, privilegios actualizados y 9 Personas reconciliadas. Se conservaron 9 Personas, 1 célula, 1 membresía, 1 Usuario, 1 reunión y 0 marcas de asistencia. Resultado correcto: 0 alertas y 0 casos. La cuenta existente conserva su contraseña. El servicio reiniciado respondió correctamente a `/health/ready`.
