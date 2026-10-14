# Operación — seguridad 0.4 y Células 1.2

## Instalación desde cero

Requiere Node.js 24.15+ y npm. Ejecutar `npm ci`. `package-lock.json` fija las versiones. No hay compilación del frontend.

### PostgreSQL local sin Docker

En una terminal, `npm run db:local`. Utiliza PostgreSQL real portable (dependencia exclusiva de desarrollo), escucha en 127.0.0.1:55432 y conserva sus datos en `.local/postgres`. Genera contraseñas aleatorias y un `.env` privado si no existe; nunca reemplaza un `.env` existente. Mantener esa terminal abierta. Ctrl+C detiene PostgreSQL sin borrar datos. Los binarios portables no se usan en producción.

En otra terminal:

```text
npm run db:migrate
npm run db:grant-local
npm run admin:create
npm run db:seed
npm run dev
```

`db:seed` es opcional, solo crea personas ficticias cuando la base está vacía y se niega en producción. Abrir http://127.0.0.1:5173. El administrador de desarrollo se llama `admin.desarrollo`; su contraseña aleatoria se entrega en `.local/admin-credentials.txt`, ignorado por Git. No hay credenciales estáticas ni registro público. Una cuenta existente nunca se sobrescribe.

Para otra cuenta: `npm run admin:create -- --username=nombre`. Para suministrar una contraseña sin ponerla en los argumentos, añadir `--password-stdin` y enviar una única contraseña mediante stdin desde el gestor de secretos/terminal. Se exigen 14–256 caracteres y se almacena Argon2id (64 MiB, 3 iteraciones, paralelismo 1). En producción se exige explícitamente usuario y stdin, y no se escribe un archivo de credenciales.

### PostgreSQL existente o administrado

Crear una base vacía PostgreSQL 15+; versión verificada localmente: 18.4. Copiar `.env.example` a `.env` y configurar `DATABASE_URL` para el rol de ejecución, `MIGRATION_DATABASE_URL` para el propietario de migraciones, `SESSION_SECRET` generado con un CSPRNG y `APP_ORIGIN`. No versionar ese archivo. Habilitar `pg_trgm` mediante la primera migración con un usuario autorizado. Ejecutar `db:migrate` antes de iniciar la aplicación.

Separar propietario del esquema de usuario de ejecución. Este último necesita:

- `USAGE` sobre el esquema y secuencias utilizadas.
- `SELECT, INSERT, UPDATE` en `people`, `cells` y `cell_memberships`.
- `SELECT, INSERT` en `cell_events` y `cell_operations`.
- `SELECT, INSERT` en `person_events`.
- Solo `INSERT` en `audit_events`.
- Solo `SELECT` en `users`, `roles`, `permissions`, `role_permissions`, `user_roles`.
- `SELECT, INSERT, UPDATE, DELETE` en `sessions`.

`db:grant-local` aplica esa política al rol fijo `erp_app` exclusivamente en desarrollo. El usuario de ejecución no debe ser propietario, superusuario ni tener permisos de DDL. No entregar `MIGRATION_DATABASE_URL` al proceso web de producción: usarla en un job/entorno administrativo separado.

### Conversión de la base 1.1

Detener el servidor SQLite anterior y conservar su archivo original y archivos WAL/SHM si aún existen. Ejecutar `npm run db:import-sqlite -- ruta/al/erp.sqlite` después de las migraciones y antes del seed. El destino debe tener `people` vacío. La herramienta lee SQLite en modo solo lectura, copia UUID, datos, versiones, marcas temporales, eventos y auditoría en una transacción PostgreSQL, y registra una huella del conjunto importado. Repetir la misma conversión no duplica registros. Una conversión distinta sobre Personas no vacía se rechaza.

La aplicación no vuelve a SQLite si PostgreSQL falla. `node:sqlite` existe únicamente en esta herramienta y en su prueba de conversión. El esquema antiguo se conserva como referencia en `scripts/legacy/001_people.sql`; no forma parte de las migraciones PostgreSQL activas.

### Reset exclusivamente local

Detener la aplicación, hacer backup si interesa conservar datos y ejecutar:

```text
npm run db:reset -- --confirm-delete-local-data
npm run db:grant-local
npm run admin:create
npm run db:seed
```

El reset **borra todos los datos de la base `erp` local**, incluida la auditoría y las cuentas. Exige development, loopback, nombre exacto de base y confirmación explícita por argumento; se rechaza en producción. No se ejecutó sobre la base del usuario durante esta fase.

## Variables

| Variable | Uso |
|---|---|
| NODE_ENV | development, test o production |
| DATABASE_URL | PostgreSQL del rol web; obligatoria |
| MIGRATION_DATABASE_URL | Propietario, solo comandos administrativos |
| SESSION_SECRET | Aleatoria, ≥48 caracteres; sin valor por defecto |
| APP_ORIGIN | Origen exacto; obligatorio y HTTPS en producción |
| HOST / PORT | Bind HTTP, 127.0.0.1 / 5173 por defecto |
| TRUST_PROXY | IP/CIDR del proxy conocido; vacío si no hay proxy; nunca true ni comodín |
| SESSION_TTL_MS | Expiración absoluta, 8 horas por defecto |
| LOGIN_LIMIT / LOGIN_WINDOW_MS | 20 intentos fallidos por IP y cuenta / 15 minutos |
| API_LIMIT | 300 solicitudes por minuto e IP |
| DB_SSL / DB_CA_FILE | TLS PostgreSQL con verificación de certificado y CA opcional |
| TEST_DATABASE_URL | Conexión administrativa para crear bases efímeras aisladas |
| BACKUP_DATABASE_URL / PG_DUMP_BIN | Rol de backup y ejecutable pg_dump opcionales |

La configuración falla antes de arrancar si faltan datos críticos. Para generar un secreto, utilizar 48 bytes de `crypto.randomBytes` y convertirlos a hexadecimal/base64, guardándolo directamente en el gestor de secretos, no en logs. Rotar `SESSION_SECRET` invalida las cookies anteriores y exige volver a entrar.

## Sesiones y cuentas

Las sesiones se guardan en PostgreSQL. Cookie firmada HttpOnly y SameSite=Strict; en producción `__Host-erp.sid`, Secure, path `/`, sin Domain. El identificador rota al iniciar sesión y se elimina al cerrar sesión. La expiración absoluta se comprueba en servidor; actividad continua no la prolonga. Los permisos y el estado activo se consultan en cada petición, sin caché de autorizaciones antiguas.

Revocar sesiones: `npm run admin:revoke -- UUID`. Desactivar también la cuenta: `npm run admin:revoke -- UUID --deactivate`. Estas operaciones administrativas requieren credenciales de base autorizadas; no tienen endpoint público. Persona y Usuario son tablas distintas; `users.person_id` es opcional y único.

## HTTPS, proxy y logs

Producción requiere un proxy TLS y un origen HTTPS configurado. El backend rechaza peticiones no HTTPS salvo que un proxy explícitamente confiable declare correctamente el protocolo. El firewall debe impedir acceso directo al backend desde Internet. No se instalaron certificados autofirmados.

Logs JSON con info/warn/error/security y request ID. Solo se registran método, plantilla de ruta, estado, duración, códigos y UUID técnicos. No se registran contraseñas, cuerpos, cookies, tokens, texto SQL ni información personal. El proveedor deberá recolectarlos con acceso restringido y retención. Las respuestas de error no revelan stack ni detalles PostgreSQL; el request ID permite correlacionar.

`GET /health/live`: proceso HTTP. `GET /health/ready`: conexión esencial a PostgreSQL; 503 si falla, sin detalles internos. No usar búsquedas de Personas como health check.

## Backup y restauración

Propuesta inicial para producción, pendiente de ajuste al RPO/RTO de la organización:

1. PostgreSQL administrado con backups automáticos diarios y PITR/WAL continuo. Objetivo inicial RPO ≤15 minutos y RTO ≤4 horas, sujeto a pruebas con el proveedor.
2. Retener 30 backups diarios y 12 mensuales; copia cifrada en una cuenta/ubicación independiente, acceso mínimo y protección contra borrado accidental. Mantener claves de cifrado y procedimiento de recuperación separados de la aplicación.
3. Alertar ante backup fallido o ausencia del último backup. Comprobar integridad del archivo y manifiesto; no considerar suficiente que el archivo exista.
4. Cada mes, restaurar un backup elegido en una instancia aislada con acceso restringido. Verificar versión de migraciones, conteos, restricciones, muestras de UUID, eventos/auditoría y pruebas funcionales. Registrar tiempos, resultado y fecha; eliminar la instancia de ensayo según política de retención.
5. Antes de cada migración de producción, backup y restauración de ensayo. Para volver atrás, desplegar la versión compatible sobre una restauración verificada; no editar tablas manualmente.

`npm run db:backup` utiliza `pg_dump --format=custom --no-owner --no-acl` y excluye datos de sesiones; pasa credenciales por entorno, no por argumentos ni logs. Requiere los **clientes oficiales PostgreSQL** (no incluidos en el paquete portable de desarrollo). Guarda en `backups/`, ignorado por Git; el archivo todavía debe cifrarse y copiarse fuera del host. Usar una versión de pg_dump compatible con el servidor.

Restaurar con `pg_restore --no-owner --no-acl --exit-on-error --dbname NOMBRE_BASE_AISLADA archivo.dump`, proporcionando host, puerto, usuario y contraseña mediante entorno/gestor de secretos o PGPASSFILE protegido. Nunca apuntar el ensayo a producción. Después aplicar los grants del rol web y verificar auditoría y restricciones. No reutilizar sesiones restauradas: el dump lógico las excluye; después de una restauración física/PITR revocarlas antes de abrir tráfico.

**No se ejecutó un ensayo pg_dump/pg_restore en este equipo:** el paquete portable no trae esos clientes y esta fase exige preparar/documentar la estrategia, sin contratar proveedor. Las migraciones desde cero y la conversión transaccional sí se probaron con PostgreSQL real. La restauración operativa queda como condición previa al despliegue.

## Pruebas y actualización

Con PostgreSQL local activo: `npm test`. El propietario de tests necesita crear/eliminar bases; cada caso usa un nombre aleatorio `erp_test_*`, nunca resetea `erp`. Los 12 casos anteriores permanecen, adaptados de llamadas SQLite síncronas a PostgreSQL asíncrono y sesiones reales.

Pruebas con navegador: `npm run test:browser` (Playwright disponible; se puede especificar PLAYWRIGHT_PATH y BROWSER_CHANNEL=msedge). Crean cuentas y bases temporales; no usan la contraseña del administrador local.

Ejecutar `npm audit`, `npm audit --omit=dev`, `npm run check:secrets` y las suites antes de publicar. Revisar actualizaciones de dependencias y parches PostgreSQL mensualmente; aplicar urgencias de seguridad según impacto, sin upgrades mayores ciegos. El análisis npm no cubre vulnerabilidades de los binarios PostgreSQL ni sustituye una revisión de seguridad.

La Subfase 1.2 agrega `003_cells.sql`; aplicar `db:migrate` y renovar los grants antes de reiniciar. Ver `CELULAS.md` para reglas, fechas, integración, permisos y cierre.

El ajuste operativo agrega `004_office_workflow.sql`: normaliza sexo de Persona con auditoría, permite fechas desconocidas de célula e incorpora BATCH_ASSIGN. Requiere `db:migrate`, sin nuevas variables o grants. Ver `AJUSTE-OFICINA-CSV.md`.

La Subfase 1.3 agrega `005_meetings_attendance.sql`: reuniones, asistencia relacional, snapshots, versiones de horario, historial y permisos. Requiere `db:migrate` y renovar grants con `db:grant-local` antes de reiniciar. No requiere cambiar credenciales, variables ni instalar dependencias. Ver `REUNIONES-ASISTENCIA.md`.


## Portal Líder 1.4

Aplicar la migración `006_leader_portal.sql` con `npm run db:migrate` y reiniciar la aplicación. Crea el permiso y rol del portal sin asignarlo automáticamente ni cambiar contraseñas. La administración explícita de cuentas usa `npm run leader:account`; vinculación, creación por contraseña en stdin y revocación están documentadas en [Portal Líder](PORTAL-LIDER.md). Los roles administrativos existentes se conservan. No hace falta una variable nueva ni un grant adicional para esta migración de datos.


## Seguimiento 1.5

Con la aplicación detenida, ejecutar `npm run db:migrate`, `npm run db:grant-local` y `npm run followup:rebuild`; después reiniciar. La migración 007 agrega tablas y permisos; no cambia Personas ni membresías. La reconciliación usa la asistencia existente y puede abrir casos históricos para revisión de Oficina. Ver [Seguimiento](SEGUIMIENTO.md) para reglas, privilegios y límites. No enviar SQL directo como sustituto de los servicios transaccionales.


## Administración transversal 0.5

Detener la aplicación, ejecutar `npm run db:migrate` y `npm run db:grant-local`, y reiniciar. La migración 008 agrega permisos explícitos, perfiles y una vista de auditoría limitada a cuentas. Si existe exactamente una cuenta activa con el rol global Oficina administrativa, recibe Administrador General, conservando sus credenciales y rol anterior. Para instalaciones ambiguas, usar el CLI autorizado `admin:create`; no se promueven todas las cuentas de Oficina.

Administración → Usuarios permite gestionar cuentas, permisos, vinculación, suspensión, contraseñas y sesiones. Las operaciones sensibles requieren la contraseña actual del operador. Ficha 360° ofrece Crear/habilitar usuario o Ver cuenta. Los CLI siguen disponibles. Consultar [Administración de usuarios](ADMINISTRACION-USUARIOS.md) para alcances, privilegios y límites.
