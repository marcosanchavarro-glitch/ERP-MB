# Células — entrega de Subfase 1.2

**Ajuste posterior vigente:** ver [Personas + Células + preparación CSV](AJUSTE-OFICINA-CSV.md). Se agregó alta contextual, selector masivo y apertura desconocida. Las reglas originales que cambian se precisan allí.

## Base encontrada y alcance

Se inspeccionó el monolito ES/Node existente: Personas central con UUID, PostgreSQL, servicios/repositorios, sesiones, permisos por alcance, auditoría inmutable, migraciones con checksum y Ficha 360° contextual. Antes de modificar se ejecutaron las 23 pruebas Node y las tres suites de navegador existentes: todas aprobadas. No se reinició ni sustituyó el proyecto.

La nueva funcionalidad vive en `server/cells`, `src/cells` y el contrato compartido `src/domain/cell.js`. Reutiliza identidad, CSRF, transacciones, logging, errores, auditoría y enlaces contextuales de Persona. PostgreSQL sigue siendo la única base de ejecución; no hay nuevas dependencias npm.

## Modelo y migración

`server/db/migrations/003_cells.sql` agrega:

| Tabla | Responsabilidad |
|---|---|
| cells | UUID permanente, grupo A–Z, generación 1–9999, sexo F/M, código generado, estado, apertura/cierre, reunión habitual, ubicación, notas, versión y última fecha efectiva |
| cell_memberships | Persona y célula por UUID, jerarquía, inicio/final, secuencia y operaciones que abren/cierran el período |
| cell_operations | Movimiento administrativo, origen, destino común opcional, fecha efectiva, motivo y actor |
| cell_events | Línea de tiempo funcional, persona/operación relacionadas, fecha efectiva y fecha de registro |

El origen de multiplicación es una FK opcional `originCellId`, sin relaciones inventadas ni editor en esta fase. Latitude/longitude quedan reservadas sin mapas ni geocodificación. La identidad interna siempre es UUID; `displayCode` se calcula en PostgreSQL a partir de componentes. El índice único parcial solo comprende células ACTIVE. Una nueva J1 F tras cerrar la anterior recibe otro UUID, sin heredar su historia.

Índices cubren código activo, listado ordenado, día, localidad, búsqueda trigram, integrantes vigentes, historial por Persona y eventos por célula. Listados, búsqueda e historial se paginan en SQL, máximo 50 filas por petición; conteos de integrantes se obtienen con una consulta agregada para toda la página, sin N+1.

## Pertenencias y jerarquías

Solo existen LEADER/Líder, ASSISTANT/Asistente y MEMBER/Miembro. El servicio y un trigger PostgreSQL impiden superar dos líderes o tres asistentes. La falta de líder se muestra como pendiente operativo; se permite crear una célula vacía y realizar cambios de liderazgo por etapas. No se rechaza una pertenencia por comparar el sexo de Persona con F/M de la célula.

Un índice único parcial sobre Persona impide dos membresías abiertas, cualquiera sea su jerarquía. Las FKs exigen Personas y Células existentes. Los integrantes se eligen mediante búsqueda paginada de Personas; el ajuste posterior reutiliza el alta rápida de Persona dentro del contexto, sin crear otra entidad. El alta completa sigue disponible.

Cambiar jerarquía finaliza un período y crea otro en la misma célula. Cambiar liderazgo usa esa operación: finalizar/promover/demover no crea otra célula. Finalizar pertenencia deja a la Persona sin célula actual, conservando todos los períodos. Los registros cerrados no se reescriben ni se eliminan. La Ficha 360° muestra la jerarquía y el inicio del período vigente y todos los períodos anteriores accesibles.

## Fechas: decisión que afecta Asistencia futura

Fechas efectivas son días de calendario de Argentina, desde 1900 y no futuras. Se procesan en orden: cada movimiento debe ser igual o posterior a la última fecha efectiva de todas las células afectadas y al inicio de la pertenencia. Una nueva pertenencia no puede comenzar antes del final de la anterior. La fecha de apertura conocida queda fija; el ajuste posterior permite apertura NULL y completarla después, sin contradecir pertenencias. Estas restricciones evitan insertar cambios retroactivos que contradigan períodos o cupos históricos.

Los períodos se interpretan como **[inicio, fin)**: el día de traslado corresponde al destino. Se permiten cambios sucesivos el mismo día; una secuencia registra su orden, incluso para períodos de duración cero. No hay movimientos programados, corrección retroactiva ni reapertura en esta fase.

Asistencia deberá referenciar UUID de célula y Persona, y resolver la membresía válida a la fecha de reunión. Si se necesita distinguir varios movimientos dentro de un mismo día o corregir historia, habrá que acordar una política específica antes de implementar esas capacidades. El horario habitual es descriptivo; no genera reuniones.

## Transferencia, absorción, redistribución y cierre

**Transferencia:** bloquea origen/destino y Persona, verifica permisos en ambos extremos y cupos del destino, finaliza la membresía anterior y abre la nueva. Una misma operación relaciona ambos períodos, eventos en ambas células y auditoría con antes/después.

**Absorción:** el usuario elige un único destino y revisa la jerarquía de cada integrante. Se conserva origen, destino, fecha y Personas transferidas; el origen cierra y el destino continúa.

**Redistribución:** cada integrante recibe un destino y una jerarquía antes de confirmar. El servidor exige exactamente una asignación por cada integrante vigente, sin omisiones ni duplicados. Verifica cupos proyectados para el conjunto, no solo fila por fila.

**Cierre total:** finaliza todas las pertenencias sin crear otras, cierra la célula y libera su código. Ninguna Persona se elimina. No hay DELETE ni reapertura.

Las tres formas de cierre presentan una revisión final con nombres, destinos, jerarquías y fecha antes de confirmar. En traslados de cierre se propone Miembro como jerarquía inicial para revisión explícita; no se promueve automáticamente a nadie. La revisión admite hasta 5000 integrantes, con peticiones paginadas y un límite HTTP de 1 MiB exclusivo del endpoint de cierre. El resto conserva 32 KiB. Un volumen mayor requiere adaptar esa preparación, nunca omitir integrantes.

Todas las escrituras se realizan en una transacción: membresías + estado/versiones + operaciones + eventos + auditoría. Bloqueos de células ordenados por UUID y de Personas serializan conflictos sin bloquear listados. Cada movimiento incrementa versiones; una edición/cierre obsoleto se rechaza. Los triggers impiden cerrar una célula que todavía tenga integrantes activos y modificar una célula cerrada.

## Permisos, privacidad y auditoría

Se agregaron `celulas.ver`, `celulas.crear`, `celulas.editar`, `celulas.gestionar_integrantes`, `celulas.transferir`, `celulas.cerrar`. Se asignan al rol administrativo existente mediante migración; el CLI de cuentas también los contempla.

Los alcances global y cell se aplican centralmente: listas y búsquedas filtran el alcance; manipular un UUID no habilita una ficha, historial o escritura. Transferencia y cierre con destinos requieren permiso de transferencia en origen y destinos. Crear requiere alcance global. No hay comprobaciones de nombre de rol en rutas o interfaz.

Los datos/enlaces personales requieren además `personas.ver` para cada Persona; integrantes no accesibles muestran un rótulo restringido. La preparación de cierre requiere acceso a todos sus integrantes. Ficha 360° celular cruza ambos permisos: Persona accesible y células accesibles. Las células relacionadas en eventos solo se muestran si están dentro del alcance. Los alcances de Persona no se amplían implícitamente por ser líder.

`leader-access.mjs` permite resolver Usuario → Persona vinculada → membresía vigente Líder → célula. No otorga permisos automáticamente ni crea una vista de asistencia.

La auditoría reutiliza `audit_events`, con actor autenticado, entidad CELL, UUID, acción, cambios y contexto de operación/fecha/motivo. El historial funcional es `cell_events`; no expone el JSON técnico de auditoría. Sesiones, Argon2id, HTTPS en producción, CSRF, rate limiting, validación, consultas parametrizadas, escape HTML, CSP y errores seguros de 0.4 siguen activos.

## Actualizar la instalación existente

Con PostgreSQL activo y la aplicación detenida:

```text
npm run db:migrate
npm run db:grant-local
npm run dev
```

La migración conserva Personas, cuentas, sesiones y auditoría anterior. La cuenta administrativa local existente recibe permisos; no hace falta recrearla ni cambiar contraseña. Células comienza sin datos inventados. Para instalaciones nuevas, seguir `OPERACION.md`; se aplican las cuatro migraciones y `admin:create` crea el administrador inicial.

En producción, el rol web requiere SELECT/INSERT/UPDATE en cells y cell_memberships; SELECT/INSERT en cell_operations y cell_events; USAGE/SELECT en sus secuencias. No debe ser propietario ni tener DELETE/DDL. El script de grants sigue siendo exclusivamente local. No se desplegó a producción.

## Verificación y deuda

Se mantienen todos los casos previos; solo se actualizaron expectativas que cambian por alcance: tres migraciones, Células disponible y contenido celular real en vez del placeholder. Las pruebas nuevas cubren códigos, cupos, pertenencia única, períodos, cambios de liderazgo, fechas, traslados, absorción, redistribución, cierre, reutilización, SQL directo concurrente, rollback, IDOR, CSRF, mass assignment, integración y rendimiento paginado.

La suite de navegador de Células prueba alta/edición, escape de texto, buscadores, paginación, jerarquías, traslados, revisión de cierres, absorción, redistribución, reutilización y Ficha 360° completa/contextual en 1440/820/390/320 px. Los resultados finales quedan registrados en README y `test-results/` (excluido de Git).

Deuda explícita: sin editor de permisos ni asignación automática de alcance a líderes; sin corrección retroactiva, reapertura ni editor del origen opcional; límite de preparación de cierre de 5000 integrantes; pruebas de volumen locales no sustituyen carga concurrente de producción. Continúan pendientes el ensayo operativo de restauración, infraestructura HTTPS y monitoreo detallados en 0.4. Los borradores sobreviven a una sesión vencida del mismo usuario, pero no al cierre del navegador.

**No se desarrolló Asistencia, reuniones semanales, mapas, seguimiento ni otra fase.** Esas secciones siguen pendientes. No se utilizó información personal histórica de Manantial ni se integró Notion.

Resultado final: **34/34 pruebas Node** y **4/4 suites de navegador** aprobadas; las 23 pruebas previas siguen pasando. Verificación de secretos sin hallazgos heurísticos. Sin dependencias nuevas.
