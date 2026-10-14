# Subfase 1.3 — Reuniones y asistencia

## Uso

**Oficina → Asistencia** abre el control semanal. Consultar una semana genera sus reuniones faltantes si la cuenta tiene permiso de generación. No requiere crear reuniones individualmente. Las cifras distinguen reuniones cargadas, pendientes, próximas y canceladas; Cargadas incluye las cerradas.

Abrir una reunión que ya llegó a su día/hora, elegir **Abrir reunión para cargar**, marcar Presentes/Ausentes y **Guardar asistencia**. Hay búsqueda y “Marcar todos presentes”; esta última acción alcanza también a las personas ocultas por la búsqueda. El contador es global. Cada persona empieza **sin marcar**, y guardar exige una decisión explícita para todas. El formulario admite observación general e individual; ninguna observación cambia el estado.

Una reunión cargada puede corregirse con permiso de edición. **Cerrar reunión** requiere confirmación. Una cerrada solo admite **Reabrir para corregir**, con permiso separado y motivo obligatorio. **Cancelar reunión** también requiere confirmación y motivo. La interfaz conserva marcas ante errores de red, sesión vencida del mismo usuario o conflicto de versión; no reintenta escrituras automáticamente. Cambiar de usuario descarta la pantalla de la sesión anterior.

En **Célula → Reuniones** se consultan ventanas de cuatro semanas; **Célula → Asistencia** muestra la matriz dinámica. En móvil, cada persona se representa como una tarjeta con fechas y significados completos. La **Ficha 360° → Asistencia**, incluida la ficha contextual, ofrece historial paginado y enlaces a reunión/célula.

## Modelo y migración

La migración `005_meetings_attendance.sql` agrega:

- `cell_schedules`: revisiones inmutables del día/horario, semana efectiva, actor y fecha de registro.
- `cell_meetings`: UUID, célula UUID, semana, fecha, horario previsto, revisión de horario UUID, estado, observación, motivo de cancelación, captura de integrantes, última carga, actores de creación/actualización, timestamps y versión.
- `meeting_attendance`: clave `(meetingId, personId)`, membresía UUID, rol y fechas del período capturado, estado nullable, observación individual y timestamp. Una fila sin marca no es una ausencia.
- `attendance_states`: catálogo relacional inicial con PRESENT y ABSENT. Ampliarlo requerirá una fase y migración explícitas.
- `meeting_events`: historial inmutable de generación, apertura, guardado, cambios individuales, cierre, reapertura, cancelación y reprogramación.

No hay columnas por semana, copias de Persona ni nuevas identidades para miembros. Todas las referencias de dominio usan UUID. Los registros funcionales y la auditoría global son append-only; las marcas pueden corregirse solamente mediante el servicio autorizado y las transiciones admitidas.

## Generación e idempotencia

La generación es **bajo demanda**, mediante `POST /api/meetings/generate` protegido por sesión, CSRF y `asistencia.generar`. La UI lo ejecuta al consultar la semana o ventana celular; una cuenta de solo lectura consulta lo ya generado. No hay cron ni dependencias nuevas.

Cada solicitud cubre como máximo 35 días y no llega a más de 35 días desde hoy. Las vistas iniciales usan una semana o cuatro semanas. El backend permite consultar ventanas históricas acotadas, sin cargar años completos.

Una restricción **UNIQUE(cellId, week)**, junto con `ON CONFLICT DO NOTHING`, evita duplicados incluso con solicitudes simultáneas. El generador bloquea las células en orden estable, usa sus revisiones aplicables y respeta apertura/cierre. La generación repetida sin novedades no agrega eventos ni auditorías. Solo se auditan filas nuevas, con el actor autenticado y contexto `generation: on-demand`; los procesos de migración se identifican como `system:*`.

Si falta día u horario, no se inventa una reunión: el control indica cuántas células requieren configuración. No se genera fuera del período de vida conocido de la célula. Una apertura desconocida usa la semana de registro de su primera configuración como comienzo operativo; no inventa una fecha de apertura.

## Cambios de día y horario

Los cambios de configuración de una célula existente rigen **desde el próximo lunes**. La semana actual conserva su programación. Cada cambio crea una revisión y auditoría, además del historial general de edición de Célula.

Las reuniones futuras PROGRAMADAS de esas semanas se reprograman conservando su UUID y semana, aumentando versión y registrando antes/después. Las abiertas, cargadas, cerradas y canceladas no se reprograman. Retirar día/horario cancela las futuras programadas con motivo explícito; reponerlos no revive automáticamente esas cancelaciones. Cerrar una célula cancela las programadas desde su fecha de cierre y conserva las realizadas.

**Límite histórico:** antes de esta fase no había versiones de horario. La migración registra la configuración disponible como línea base desde la semana de apertura conocida, o la semana actual si no se conoce apertura. No puede reconstruir cambios anteriores inexistentes en los datos. Generar semanas anteriores crea programación pendiente, nunca presencia/ausencia ni evidencia de que la reunión ocurrió. La importación histórica futura deberá verificar esos horarios con una fuente real.

## Membresía temporal y consistencia histórica

La pertenencia se resuelve con intervalos **[inicio, fin)**: inicio incluido, fin excluido. Una transferencia efectiva el día D corresponde al destino el día D. Los cambios de jerarquía el mismo día no duplican personas; los períodos vacíos no generan asistencia. El modelo previo registra fechas, no horas: no permite inferir si una transferencia ocurrió antes o después de una reunión dentro del mismo día.

Antes de abrir, la reunión muestra una vista previa calculada según su fecha. **Al abrir se fija un snapshot** con Persona UUID, membresía UUID, rol y fechas de pertenencia observadas. La captura y la apertura usan la misma transacción y el bloqueo de célula utilizado por las operaciones de membresía. Evita carreras entre transferencia y apertura.

Desde ese momento, las cargas y correcciones validan contra la lista fijada. Ni una transferencia posterior ni una operación retroactiva cambian automáticamente esa lista o una reunión cerrada. Reabrir permite corregir marcas y observaciones, pero **no reconstruye el snapshot**. La eventual corrección administrativa de una lista capturada erróneamente queda reservada a una operación específica, con permiso, motivo e historial; no se implementó una reescritura silenciosa. Los nombres se consultan desde Persona; su UUID y pertenencia capturada permanecen estables.

## Estados, cancelación y ausencia

| Acción | Estado inicial | Estado final |
|---|---|---|
| Generar | No existe | PROGRAMADA |
| Abrir, llegada la fecha/hora | PROGRAMADA | ABIERTA |
| Guardar marcas completas | ABIERTA | CARGADA |
| Corregir | CARGADA | CARGADA |
| Cerrar con confirmación | CARGADA | CERRADA |
| Reabrir con motivo | CERRADA | CARGADA |
| Cancelar con motivo | PROGRAMADA / ABIERTA / CARGADA | CANCELADA |

La cancelación no se revierte automáticamente. Para cancelar una cerrada hay que reabrirla de forma autorizada primero. Una cancelación conserva reunión, célula, fecha y motivo; retira las marcas actuales de asistencia y conserva sus valores anteriores en auditoría e historial. **No genera faltas**.

La clasificación temporal usa `America/Argentina/Buenos_Aires`: PROGRAMADA/ABIERTA futuras son Próximas; llegado el horario son Pendientes; CARGADA/CERRADA son Cargadas; CANCELADA se mantiene Cancelada. No hay período de gracia ni alertas automáticas. “Pendiente” nunca se convierte en “todos ausentes”.

La matriz distingue P (Presente), A (Ausente), NC (No correspondía), SC (Reunión no cargada) y C (Reunión cancelada), con leyenda, etiquetas accesibles y representación textual móvil. Una futura consulta de faltas deberá exigir reunión CARGADA/CERRADA y registro ABSENT; no debe contar NULL, canceladas ni no pertenencia.

## Seguridad, transacciones y concurrencia

Permisos nuevos: `asistencia.ver`, `asistencia.generar`, `asistencia.cargar`, `asistencia.editar`, `asistencia.cerrar`, `asistencia.cancelar`, `asistencia.reabrir`. Admiten alcance global o por UUID de célula. El rol Oficina administrativa existente recibe estos permisos en la migración; nuevas cuentas administrativas los reciben desde su CLI. No hay registro público ni cambio de contraseña.

El servidor verifica permiso y alcance en cada operación. La lectura detallada, carga e historial de reunión exigen además acceso a todas las Personas de su lista; la matriz filtra por alcance de Personas. Ficha 360° exige acceso a esa Persona y a las reuniones de las células autorizadas. Conocer un UUID no otorga acceso.

La cadena futura Usuario → Persona → membresía activa LEADER → Célula puede reutilizar `server/cells/leader-access.mjs`; sigue siendo un resolutor sin concesión implícita de privilegios. La interfaz definitiva del líder y un mecanismo de concesión dinámica quedan fuera de esta fase.

Cada escritura bloquea célula/reunión, verifica versión, valida la lista completa, guarda marcas, actualiza estado y registra historial/auditoría **en una única transacción PostgreSQL**. La segunda escritura con una versión obsoleta recibe 409; debe recargar/revisar antes de confirmar de nuevo. Los triggers protegen snapshots, estados, consolidación y cancelaciones; la aplicación no tiene DELETE en estas entidades ni UPDATE en historial/auditoría.

Se conservan autenticación, sesiones revocables, CSRF, Origin/Host, límites de peticiones, SQL parametrizado, validación de UUID/campos, escape HTML y errores seguros. La ruta específica de carga admite hasta 4 MiB y 5000 participantes (observación individual hasta 500 caracteres); el resto mantiene sus límites anteriores. No se agregaron dependencias ni variables de entorno.

## Rendimiento y pruebas

Hay índices por semana/célula, historia cronológica de célula, Persona/reunión, membresía temporal, revisión efectiva de horario e historial de reunión. La generación usa inserciones por conjunto; no lee una célula por consulta. El listado semanal y la matriz utilizan **tres consultas cada uno**, independientemente de cuántas células/personas haya; las páginas son de 50 filas. Historial de reunión y Persona usa páginas de 20. La lista de carga admite hasta 5000 personas y búsqueda local sobre esa reunión; no descarga la Matriz de Personas completa.

Se conservan los 43 tests anteriores. Se agregaron 13 casos de backend: generación/concurrencia/idempotencia, horarios, membresía temporal/transferencias/altas posteriores, carga explícita, edición/cierre/reapertura, cancelación, conflicto de versión, rollback ante fallo de auditoría, autorización/IDOR/CSRF, semana/matriz/Ficha 360°, cierre celular, snapshot cerrado frente a transferencia retroactiva y 5000 células con consultas constantes.

La sexta suite de navegador prueba generación automática, carga/corrección/cierre/reapertura/cancelación, motivo, borrador ante sesión vencida, error de red, conflicto visible, Ficha 360°, reuniones/matriz por célula y anchos 1440/820/390/320. Los resultados y capturas se guardan en `test-results/`, excluido de Git.

Resultado final local: **56/56 pruebas Node y 6/6 suites de navegador aprobadas**, con los 43 casos y cinco suites anteriores conservados. Se ajustaron las expectativas de cantidad de migraciones y estado disponible de Asistencia. La suite nueva también pasó después de fortalecer las restricciones de snapshot. El escáner de secretos pasó.

## Operación y límites de esta entrega

Detener la aplicación, mantener PostgreSQL activo, ejecutar `npm run db:migrate`, `npm run db:grant-local` y `npm run dev`. No resetear ni volver a importar datos. Para PostgreSQL externo, aplicar los permisos equivalentes documentados en `scripts/grant-local.mjs` al rol web: SELECT/INSERT en horarios y eventos, SELECT/INSERT/UPDATE en reuniones y asistencia, SELECT en el catálogo y USAGE/SELECT en secuencias.

Quedan pendientes el ensayo de restauración y los requisitos operativos previos a producción ya documentados; no hubo despliegue. También quedan fuera: corrección del snapshot, reversión de cancelación, horario efectivo arbitrario a elección del operador, importación histórica completa, vista definitiva del líder, alertas y seguimiento por inasistencias. La generación bajo demanda puede convertirse después en job manteniendo las mismas claves, permisos de servicio e idempotencia; hoy no existe un job ni una cuenta técnica nueva.

La entrega se limita a la subfase 1.3. **Pendiente no equivale a ausente; cancelación no genera faltas; las membresías actuales no reescriben asistencia histórica consolidada. No se desarrolló seguimiento por inasistencias ni se avanzó a otra fase.**


## Continuación implementada en 1.4

El Portal Líder ya reutiliza estos servicios y reglas; las menciones anteriores al portal pendiente describen el estado de entrega 1.3. Ver [Portal Líder 1.4](PORTAL-LIDER.md) para autorización, proyecciones restringidas, concurrencia y resultado de la suite ampliada.
