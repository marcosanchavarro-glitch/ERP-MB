# ERP Eclesiástico — Administración 0.5 + Oficina Manantial 1.6

[Sistema visual global: Claro, Oscuro y Sistema](docs/TEMAS-VISUALES.md). Tokens semánticos, preferencia local y base para futuras variantes por área.

[Cumpleaños y Calidad de datos 1.6](docs/CUMPLEANOS-CALIDAD.md): consultas paginadas, filtros, revisión contextual y permisos. Actualizar con `db:migrate` y `db:grant-local`, luego reiniciar; se mantienen las cuentas existentes.

[Preparación del entorno DEMO en Render](docs/DEPLOY-DEMO.md): monolito y PostgreSQL separado, identidad configurable y bootstrap ficticio. Despliegue gratuito: Render Free + Neon Free.

[Administración 0.5: usuarios, perfiles, permisos y accesos](docs/ADMINISTRACION-USUARIOS.md). Crear y vincular cuentas desde Ficha 360°, asignar áreas/subáreas, suspender, restablecer contraseñas, revocar sesiones y consultar auditoría. Actualizar con `db:migrate` y `db:grant-local`; se conserva la contraseña existente.

[Seguimiento 1.5: informe, reglas y operación](docs/SEGUIMIENTO.md). Alertas por racha, casos, contactos, regularización y privacidad. Para actualizar una instalación existente: migrar, aplicar privilegios y ejecutar `npm run followup:rebuild` antes de reiniciar.

[Portal Líder 1.4: entrega, autorización de cuentas y decisiones](docs/PORTAL-LIDER.md). Mi Célula, integrantes, ficha restringida, cumpleaños e integración con asistencia. Requiere habilitación explícita de una cuenta vinculada a Persona con liderazgo vigente; no crea usuarios automáticamente.

Monolito modular Node.js y JavaScript ES, con PostgreSQL como única base de ejecución. Conserva la navegación 0.1, Personas / Matriz + Ficha 360° de 1.1 y la seguridad transversal 0.4. Agrega Células con integrantes, jerarquías, transferencias, absorción, redistribución, cierre e historia.

[Reuniones y Asistencia 1.3: uso, modelo y decisiones](docs/REUNIONES-ASISTENCIA.md). Control semanal, carga transaccional, historial por célula, matriz y Ficha 360°.

[Ajuste operativo: alta rápida, selección múltiple y preparación CSV](docs/AJUSTE-OFICINA-CSV.md). El importador CSV completo sigue pendiente.

[Entrega y decisiones de Células 1.2](docs/CELULAS.md). Para una instalación existente: detener la aplicación, ejecutar `npm run db:migrate`, `npm run db:grant-local` y volver a iniciar. La cuenta administrativa existente mantiene su contraseña y recibe los permisos nuevos.

## Iniciar desde cero

Requiere Node.js 24.15+. Ejecutar `npm ci` y, en una terminal, `npm run db:local`. En otra:

```text
npm run db:migrate
npm run db:grant-local
npm run admin:create
npm run db:seed
npm run dev
```

El seed es opcional y exclusivamente ficticio. Abrir http://127.0.0.1:5173. La cuenta local `admin.desarrollo` recibe una contraseña aleatoria en `.local/admin-credentials.txt`, fuera de Git. El CLI no sobrescribe cuentas existentes. PostgreSQL portable escucha en loopback y conserva datos en `.local/postgres`; no requiere Docker.

[Operación](docs/OPERACION.md) detalla PostgreSQL externo, variables, administrador por stdin, migración, reset, revocación, HTTPS, privilegios, backups y restauración.

## Arquitectura y estrategia modular

- `server/identity/`: autenticación, cuentas y autorización centralizada por permisos y alcances.
- `server/people/http.mjs`: contrato HTTP, validación del sobre y aplicación de permisos.
- `server/people/service.mjs`: reglas de negocio, concurrencia y unidad transaccional.
- `server/people/repository.mjs`: SQL parametrizado de Personas e historial.
- `server/audit/repository.mjs`: auditoría reutilizable por entidad y acción.
- `server/db/`: conexiones, transacciones y migraciones versionadas con checksum y bloqueo.
- `server/core/`: configuración, errores de dominio y logging estructurado.
- `src/domain/person.js`: reglas y campos compartidos entre cliente y servidor.
- `src/people/`: interfaz existente de Personas; `src/auth/`: login y estado de sesión.
- `src/config.js`, `src/icons.js`: árbol e iconos configurables por módulo y submódulo. Se conservan biblioteca, búsqueda, vista previa y restauración; no se creó el editor administrativo.

Los adaptadores `server/access.mjs` y `server/people-store.mjs` conservan compatibilidad, sin acceso demo ni almacenamiento alternativo. Cada dominio nuevo seguirá HTTP → servicio → repositorio; la auditoría participa en la misma transacción de negocio. No hay carpetas vacías para módulos futuros ni servicios distribuidos.

## PostgreSQL y conservación de datos

Migraciones activas: `server/db/migrations/001_people.sql`, `002_identity_audit.sql`, `003_cells.sql`, `004_office_workflow.sql` `005_meetings_attendance.sql` `006_leader_portal.sql` `007_followup.sql` y `008_identity_admin.sql`. Crean Personas, eventos funcionales, usuarios, roles, permisos, asociaciones con alcance, sesiones, auditoría y registro de conversiones. `schema_migrations` controla versiones y rechaza cambios a migraciones ya aplicadas.

Persona mantiene UUID, campos, documento normalizado único, fechas, versión, completitud y espacios reservados para foto/georreferenciación futura. Usuario es otra entidad: credenciales separadas y relación opcional única con Persona. No hay relaciones ficticias con Células.

`db:import-sqlite` lee la base anterior en modo solo lectura y convierte datos, UUID, versiones, fechas, eventos y auditoría en una transacción; la huella del contenido permite repetir sin duplicar. La conversión local conservó **8 personas, 8 eventos y 8 auditorías**. El archivo original no se modificó.

**PostgreSQL reemplazó completamente a SQLite en la aplicación.** `node:sqlite` queda únicamente en el importador y su test; el esquema antiguo vive en `scripts/legacy/`. No hay fallback a SQLite ni carga automática de datos al iniciar el servidor.

## Autenticación, permisos y seguridad

Contraseñas Argon2id (64 MiB, 3 iteraciones, paralelismo 1) mediante biblioteca mantenida; cuentas administrativas, sin registro público. Login genérico ante credenciales inválidas o cuenta inactiva. Sesiones almacenadas en PostgreSQL, identificador regenerado al entrar y revocable. Cookie HttpOnly, SameSite Strict y Secure con prefijo `__Host-` en producción. Expiración absoluta de 8 horas configurable. No se guardan tokens de autenticación en localStorage.

Autorización central: usuario → roles → permisos → alcance. Están implementados `personas.ver`, `personas.crear`, `personas.editar`, `personas.historial`, con alcances global y por Persona. Células tiene permisos `celulas.*` con alcances global/cell. Los permisos `personas.*` conservan alcance global/person; no se amplían automáticamente por pertenecer a una célula. El permiso `modulos.acceder` admite área/subárea; no reemplaza los permisos funcionales para datos. Los permisos se consultan en cada petición; conocer un UUID no habilita acceso. Listado, búsqueda, localidades, ficha, cambios e historial verifican permisos en servidor. El frontend recibe capacidades solo para UX.

Se aplican CSRF, comprobación de Host/Origin, validación de campos y UUID, rechazo de campos internos, consultas parametrizadas, escape HTML, límite JSON de 32 KiB, errores seguros y Helmet. CSP permite scripts propios; estilos inline se conservan por compatibilidad visual y Google Fonts tiene orígenes explícitos. Producción exige HTTPS y proxy confiable explícito; desarrollo usa HTTP local.

Login: 20 fallos por IP y cuenta en 15 minutos; API: 300 peticiones/minuto por IP, configurables. Estos contadores residen en memoria por proceso: para varias instancias se necesita un limitador compartido o en el gateway. No se añadió Redis.

## Integridad, auditoría y operación

Alta/edición, historial y auditoría se confirman juntos o se revierten juntos. Bloqueo de fila y versión evitan sobrescrituras silenciosas; restricciones SQL protegen documentos duplicados incluso con concurrencia.

`person_events` es historial funcional. `audit_events` conserva actor, acción, entidad, UUID, fecha, cambios anteriores/nuevos y contexto; no se muestra como historial ni tiene editor. Triggers bloquean UPDATE/DELETE/TRUNCATE. El rol web solo puede INSERT en auditoría, sin privilegios de propietario. Un administrador de base sigue siendo una autoridad privilegiada: esto no es almacenamiento WORM externo.

Logs JSON con niveles info/warn/error/security y request ID, sin cuerpos, SQL, contraseñas, cookies ni datos personales. Errores HTTP no muestran stack ni infraestructura. `/health/live` comprueba proceso y `/health/ready` conexión PostgreSQL.

Filtros, búsqueda, orden y paginación se ejecutan en SQL (máximo 50 filas); índices B-tree y GIN trigram responden a consultas existentes. La prueba de 20.000 registros verifica búsqueda, filtro, página 300 e índice después de VACUUM/ANALYZE de la carga masiva. En producción mantener autovacuum y observar planes reales; esta prueba no representa carga concurrente ni un SLA.

Backups propuestos: diarios, PITR/WAL, retención 30 diarios/12 mensuales, copia cifrada independiente y restauración mensual verificada. `db:backup` prepara un dump lógico sin datos de sesiones. Requiere clientes oficiales PostgreSQL; **no se ejecutó un ensayo pg_dump/pg_restore** en este equipo. El detalle y objetivos RPO/RTO tentativos están en Operación.

## Dependencias y comprobaciones

Se agregaron Express, pg, argon2, express-session, connect-pg-simple, Helmet y express-rate-limit. `embedded-postgres` solo facilita desarrollo. No se eliminaron dependencias previas de producción porque no existían. El lockfile fija el árbol instalado.

```text
npm test
npm run test:browser
npm audit
npm audit --omit=dev
npm run check:secrets
```

Los tests crean bases PostgreSQL aisladas `erp_test_*` y cuentas temporales. Playwright puede localizarse mediante `PLAYWRIGHT_PATH`; `BROWSER_CHANNEL=msedge` selecciona Edge.

**Los 12 casos anteriores permanecen y pasan**, adaptados a PostgreSQL asíncrono y autenticación real. Resultado de 0.4: **23/23 pruebas Node aprobadas**, conservadas como regresión de 1.2. Las pruebas nuevas cubren login/logout, expiración/revocación, permisos/IDOR, CSRF, payloads, SQLi/XSS, rate limiting, errores, transacciones, concurrencia, auditoría inmutable, HTTPS/cookies, logging, conversión y volumen.

Las nueve suites de navegador incluyen navegación, Personas, autenticación, Células, el ajuste operativo Reuniones/Asistencia, Portal Líder, Seguimiento y Administración de usuarios. Verifican 1440, 820, 390 y 320 px; contexto/foco, Ficha 360°, alta/edición, duplicados, borradores, red/reintentos, conflictos y sesión vencida. Resultados y capturas quedan en `test-results/`, fuera de Git.

Auditorías npm completas y de producción: **0 vulnerabilidades reportadas** en esta verificación. El escáner de secretos no encontró patrones en archivos candidatos a Git; `.env`, credenciales, bases y backups están excluidos. Son controles concretos, no un pentest ni garantía de ausencia de vulnerabilidades.

## Límites y decisiones de seguridad vigentes

Se corrigieron la persistencia SQLite, la confianza en acceso demo local, el actor demo de nuevas operaciones y la falta de autorización efectiva. Se conserva el contrato de Persona y la interfaz existente.

Antes de producción faltan desplegar/configurar HTTPS y PostgreSQL administrado, secretos externos, backups con restauración ensayada, monitoreo/retención de logs y prueba de carga del entorno real. El PostgreSQL portable es solo desarrollo. La limitación por proceso requiere revisión antes de escalar horizontalmente. No se implementaron MFA ni recuperación por email. La administración de usuarios y permisos está disponible en la fase transversal 0.5.

Para futuras fases son obligatorias **funcionalidad, seguridad, rendimiento y testing**. Toda API debe definir autenticación, permiso y alcance, validación, auditoría y transacciones cuando correspondan, errores seguros y pruebas de acceso negativo. Toda modificación del esquema debe ser una migración nueva, nunca una edición manual de producción.

Se completaron Células 1.2 y Reuniones/Asistencia 1.3. No se desplegó a producción. Seguimiento por inasistencias se incorpora en 1.5; otros módulos posteriores siguen pendientes. Los borradores continúan en memoria y no sobreviven al cierre del navegador. Los iconos configurables y los estados pendientes existentes se mantienen.


Verificación histórica del ajuste 1.2: **43/43 pruebas Node aprobadas** (34 anteriores + 9 del ajuste) y **5/5 suites de navegador aprobadas**. Se verificaron 5000 células con paginación en tres consultas y se conservó la prueba anterior de 20.000 Personas. Los resultados son locales, sin SLA.

Ajuste operativo posterior: Hombre/Mujer en Persona (NULL permitido), alta rápida reutilizable, selección persistente entre búsquedas y asignación transaccional de hasta 500 Miembros por lote. Las transferencias desde el selector requieren confirmación. Células admite apertura desconocida y muestra información pendiente sin inventar datos. Ver la documentación del ajuste para la preparación de CSV y las decisiones de migración.

Verificación histórica 1.3: **56/56 pruebas Node y 6/6 suites de navegador aprobadas**. Reuniones y asistencia agregan 13 pruebas de backend y una suite de navegador. Se conservan los casos anteriores; se actualizaron las expectativas de migraciones y disponibilidad de Asistencia. Ver `docs/REUNIONES-ASISTENCIA.md` para decisiones temporales, límites y preparación de la siguiente fase.

Verificación histórica 1.4: **69/69 pruebas Node y 7/7 suites de navegador aprobadas**. Se conservan las fases anteriores. La entrega 1.4 se detuvo antes de Seguimiento.

Verificación histórica 1.5: **83/83 pruebas Node y 8/8 suites de navegador aprobadas**. Seguimiento agrega 14 pruebas de backend y una suite de navegador. No se avanzó a 1.6.

Verificación final transversal 0.5: **94/94 pruebas Node y 9/9 suites de navegador aprobadas**. Sin dependencias nuevas ni avance a 1.6.

Nuevos, Recepción e integración: [guía funcional y técnica](docs/NUEVOS.md).

Dashboard de Oficina: [fuentes, permisos y validación](docs/DASHBOARD-OFICINA.md).
