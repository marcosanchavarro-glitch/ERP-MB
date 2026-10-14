# Entorno DEMO en Render

Esta instalación es exclusivamente una demostración con datos ficticios. No es la base oficial de la iglesia. Las funcionalidades existentes hasta Administración 0.5 / Oficina 1.5 se conservan; este trabajo no agrega fases funcionales.

## Auditoría previa

El proyecto es un monolito modular Node.js 24 / Express 5. Sirve HTML, CSS y módulos JavaScript desde el mismo proceso que las API. No necesita compilación de frontend ni un segundo servicio web. PostgreSQL almacena Personas, Células, reuniones, asistencia, usuarios, permisos, auditoría y sesiones. No utiliza SQLite en ejecución.

Las API del navegador usan rutas relativas. Las direcciones de localhost pertenecen a los valores predeterminados de desarrollo, herramientas locales y pruebas. El servicio publicado debe escuchar en `0.0.0.0:$PORT` y usar el origen HTTPS asignado por Render, nunca el origen de desarrollo.

Las ocho migraciones existentes usan checksum, transacciones y bloqueo PostgreSQL para evitar aplicaciones simultáneas. Las contraseñas usan Argon2id; los permisos se consultan en cada petición. Las cookies tienen HttpOnly, SameSite Strict y Secure en modo production. CSRF y validación de Origin permanecen activos. Al mantener frontend y API en el mismo origen no se necesita CORS.

## Separación y servicios previstos

| Entorno | Proceso | Datos y secretos |
| --- | --- | --- |
| LOCAL | `npm run dev`, loopback | `.env`, PostgreSQL local existente |
| DEMO | Un Web Service Node en Render | PostgreSQL nuevo exclusivo y secretos nuevos |
| PRODUCCIÓN futura | Instalación independiente | Otra base, otros secretos, identidad configurable |

Repositorio autorizado: `https://github.com/marcosanchavarro-glitch/ERP-MB`. Workspace confirmado: My Workspace. No se deben modificar los servicios o bases de otros proyectos.

El cupo gratuito de PostgreSQL de Render está ocupado por otro proyecto y no se modifica. Se utiliza Neon Free: proyecto `erp-demo` (`odd-smoke-59716181`), rama `demo`, base `erp_demo`, región Oregon. La conexión TLS y el bootstrap con ocho cuentas ficticias se verificaron. Render utiliza exclusivamente un Web Service Free.

## Estado de publicación

Servicio creado: `erp-mb-demo` (`srv-db7cjsaj9qps73bubb50`), Render Free, Oregon. URL asignada: https://erp-mb-demo.onrender.com. El health check está configurado en `/health/ready`. Despliegue confirmado `live` y 99 comprobaciones HTTP públicas aprobadas: HTTPS, assets, identidad, cookies Secure/HttpOnly/SameSite Strict, CSRF/Origin, ocho perfiles, Personas/Células, asistencia histórica, Portal, IDOR, suspensión/reactivación y logout.

## Configuración preparada

`render.yaml` define un Web Service Free conectado a PostgreSQL externo en Neon Free. No crea bases de Render ni recursos de pago. La rama publicada es `codex/render-demo`.

Build: `npm ci --omit=dev`. No hay bundler, salida `dist` ni PostgreSQL portable en el servidor publicado. Node: 24.20.0. Start: `npm run start:render`. Se mantiene `npm run dev` para LOCAL. El proceso DEMO aplica migraciones antes de escuchar, porque el servicio web gratuito no dispone de pre-deploy command. Un fallo impide abrir tráfico. El bloqueo de despliegue serializa bootstrap y grants; las migraciones tienen su propio bloqueo y checksum.

El arranque crea `erp_demo_app` sin privilegios de propietario y aplica los mismos grants mínimos de LOCAL. Después cierra la conexión propietaria, elimina de `process.env` las variables de bootstrap y migración, y abre HTTP con la conexión restringida. Las credenciales propietarias siguen siendo un secreto de despliegue de Render: una futura producción debe separar el trabajo de migración del entorno runtime con un pre-deploy/job autorizado. No se presenta esta separación en memoria como aislamiento frente a un servidor comprometido.

### Variables

| Variable | Uso |
| --- | --- |
| `NODE_ENV=production` | Seguridad HTTPS real, aunque la instalación sea DEMO |
| `APP_ENV=demo` | Clasifica la instalación y permite bootstrap exclusivamente DEMO |
| `HOST=0.0.0.0`, `PORT` de Render | Socket público detrás del proxy |
| `MIGRATION_DATABASE_URL` | URL directa de Neon PostgreSQL DEMO; secreto privado, con TLS obligatorio |
| `RUNTIME_DB_PASSWORD` | 48 bytes aleatorios hex; rol restringido; no cambiar sin rotación SQL coordinada |
| `DATABASE_URL` | Construida en memoria por el arranque usando el rol restringido |
| `SESSION_SECRET` | 48 bytes aleatorios hex, independiente de LOCAL; cambiarlo invalida sesiones |
| `DEMO_BOOTSTRAP_SECRET` | 48 bytes aleatorios hex para claves iniciales únicas; nunca público |
| `ALLOW_DEMO_SEED=true` | Habilitación explícita; desactivar tras verificar el primer despliegue |
| `APP_NAME`, `ORGANIZATION_NAME` | Identidad pública, editable sin modificar componentes |
| `APP_LOGO_PATH`, `APP_FAVICON_PATH` | Assets propios bajo `/src/`; opcionales |
| `APP_ORIGIN` / `APP_URL` | Opcionales: origen público explícito; si faltan, `RENDER_EXTERNAL_URL` suministrada por Render |
| `TRUST_PROXY` | CIDR/rangos confiables; Blueprint propone `loopback,linklocal,uniquelocal` |
| `DB_SSL`, `DB_CA_FILE` | TLS PostgreSQL si el proveedor/conexión lo necesita; nunca desactivar verificación del certificado |

No copiar `.env` local a Render. No incluir conexiones, claves ni contraseñas en Git, capturas o logs. `scripts/demo-credentials.mjs` genera un archivo **local privado** `.local/render-demo-credentials.json` con los tres secretos y claves iniciales; no lo sobrescribe. Los valores se cargan en los campos secretos de Render, no en `render.yaml`. No pegar ese archivo en issues, documentación o chat público.

### Identidad y assets

Modificar `APP_NAME` o `ORGANIZATION_NAME` en Environment y redeployar. El backend sirve título/metadata escapados y `/api/installation` publica solo datos de identidad. Login, navegación, footer y Portal consumen esa configuración; el nombre no está repetido en componentes. Los nombres funcionales de áreas existentes (por ejemplo Oficina Manantial) se conservan como conceptos de navegación, no como marca del producto.

Para logo/favicon, agregar un archivo propio, por ejemplo `src/assets/logo.svg`, a Git y configurar `APP_LOGO_PATH=/src/assets/logo.svg`. Análogo para `APP_FAVICON_PATH`; por defecto hay un icono neutral `/src/favicon.svg`. Solo se admiten rutas locales de imágenes, conforme a CSP. No se desarrolló un CMS.

### Bootstrap y datos

El seed solo se ejecuta si `APP_ENV=demo` y `ALLOW_DEMO_SEED=true`. El arranque rechaza localhost y un nombre de base sin `demo`. El primer seed exige base sin Usuarios ni Personas, y registra avance/completitud en un esquema de despliegue. Repetir no modifica cuentas, contraseñas, permisos o datos ya completados. No se abre tráfico antes de completar el primer bootstrap.

Se preparan ocho cuentas ficticias: `demo.admin`, `demo.apostol`, `demo.oficina`, `demo.lider`, `demo.asistente`, `demo.miembro`, `demo.areas` y `demo.combinado`. Todas tienen contraseñas distintas derivadas de un secreto aleatorio; no se publican claves predeterminadas. Incluye ocho Personas marcadas DEMO, dos células, roles celulares, reuniones recientes y asistencia histórica. Asistente/Miembro no reciben liderazgo artificial: sirven para comprobar denegación. El acceso combinado integra liderazgo y una subárea de Multimedia.

La primera cuenta usa Administrador General. Las claves y permisos posteriores se administran desde Usuarios con reautenticación. El bootstrap se verificó contra Neon antes de publicar. Render ya tiene `ALLOW_DEMO_SEED=false` y no recibió `DEMO_BOOTSTRAP_SECRET`; las credenciales iniciales permanecen en el archivo privado local. Reiniciar no restablece contraseñas. LOCAL no llama este seed y no se exportó su base.

### Proxy, sesiones, CSRF y health

El backend comprueba Host y Origin, exige HTTPS en API/páginas y mantiene CSRF. Render termina TLS. Solo se confía en los proxies configurados por rango; no se usa `trust proxy=true`. La validación pública debe confirmar que el último proxy pertenece a esos rangos y que Render sobrescribe X-Forwarded-Proto. Las IP públicas prefijadas por clientes no deben aceptarse como cadena íntegramente confiable. El rate limiting por cuenta complementa el límite por IP. No se agregan cabeceras CORS comodín.

`/health/ready` comprueba PostgreSQL y devuelve únicamente `ok` o `unavailable` (503). Junto con `/health/live`, acepta las sondas HTTP internas de Render sin sesión; esta excepción no aplica a páginas/API. Configurar `/health/ready` como health check. Las cookies HTTPS mantienen `__Host-`, HttpOnly, Secure, SameSite Strict y Path=/; las sesiones persisten en PostgreSQL y tienen expiración absoluta.

Logs estructurados: método, ruta, estado, duración, request ID y código seguro. Sin cuerpos, SQL, contraseñas, cookies o conexiones. Errores de API no devuelven stack. El error de bootstrap muestra únicamente fase y código seguro para evitar fugas; diagnosticar mediante un operador con acceso a configuración/migraciones, nunca habilitando logs de secretos.

## Publicación y actualización

1. Crear Neon Free exclusivo y validar `render.yaml`.
2. Ejecutar suites, revisar secretos, commit y push del código a GitHub.
3. Crear Web Service Free desde ese repositorio en el workspace confirmado; cargar los secretos privados y la conexión de Neon con `DB_SSL=true`.
4. Esperar deploy `live`, verificar URL que Render realmente asignó y ejecutar pruebas públicas.
5. Desactivar seed y comprobar un redeploy sin pérdida de datos/cuentas/sesiones.

El repositorio se clonó por URL pública. La integración GitHub actual de Render solo autoriza otro repositorio; por ello Auto-Deploy queda en Off. Para actualizar: commit y push a `codex/render-demo`, después Dashboard → Manual Deploy → Deploy latest commit (o la herramienta de deploy de Render). Para automatizar, el titular debe autorizar el repositorio ERP-MB en la instalación GitHub de Render, seleccionarlo como Git Provider y activar On Commit. No se ampliaron permisos de GitHub durante este trabajo. La base y secretos permanecen; el filesystem web es efímero y no guarda datos del ERP. No se ejecuta reset ni importación de LOCAL. Los datos persisten a través de redeploy mientras exista la base. El servicio gratuito puede dormirse por inactividad; el primer acceso puede tardar. Neon Free tiene límites propios de cómputo y almacenamiento; verificar cuotas en ambos proveedores. No se utiliza la base temporal gratuita de Render.

Rollback: volver a un commit compatible con el esquema aplicado y redeployar. No modificar checksums ni ejecutar migraciones inversas improvisadas. Se conservan los hashes históricos de dos archivos Windows mediante pares exactos auditados en `migration-checksum.mjs`: el SQL es idéntico y solo difieren CRLF/LF. Cualquier otro cambio sigue bloqueando el despliegue. Un cambio destructivo futuro exige backup y restauración ensayada en una base separada. No eliminar la base para corregir un deploy.

## Validación

Antes de cambios: 94 pruebas Node ejecutadas, 93 aprobadas y un fallo de teardown (`terminating connection due to administrator command`). La base temporal se eliminaba antes de cerrar el servidor de la prueba. Se corrigió el fixture para cerrar servidores primero y hacer el cierre idempotente. Las nueve suites de navegador iniciales pasaron. La verificación específica posterior pasó 14/14; regresión final: **100/100 pruebas Node y 9/9 suites de navegador aprobadas** (las dos pruebas adicionales cubren TLS de Neon y compatibilidad de checksum Windows/Linux). `render.yaml` validado contra el esquema oficial JSON Schema 2020-12. El CLI Render no está instalado; se utilizó validación de esquema, no validación remota de capacidad/costo.

La prueba reproducible `node scripts/smoke-demo.mjs` usa exclusivamente la URL DEMO y credenciales del archivo privado: 99 comprobaciones aprobadas. Suspende/reactiva únicamente `demo.miembro` y restaura su acceso; no cambia contraseñas ni borra datos. La revisión visual pública incluye escritorio, tablet 768 px y teléfonos 390/320 px. El entorno LOCAL responde 200 y permanece separado. Segundo despliegue confirmado `live` (`dep-db7co4jbc2fs73en3nig`, commit `93942b0`): la sesión iniciada antes del redeploy sigue autenticada y persisten 8 Personas, 2 Células, 8 Usuarios y 6 reuniones del período histórico comprobado. El Portal puede preparar automáticamente reuniones futuras adicionales.

Antes de producción siguen pendientes backups/restauración real, gestión externa y rotación de secretos, monitoreo/retención de logs y carga/concurrencia del entorno contratado y operación sin dependencia del plan gratuito. No se implementan nuevas funcionalidades como parte de este despliegue.

Referencias: [variables de Render](https://render.com/docs/environment-variables), [deploys](https://render.com/docs/deploys), [health checks](https://render.com/docs/health-checks), [límites gratuitos](https://render.com/docs/free), [planes](https://render.com/docs/compute-plans), [precios](https://render.com/pricing), [Express detrás de proxy](https://expressjs.com/en/guide/behind-proxies.html).

## Accesos y entrega

Accesos iniciales privados: `.local/ACCESOS-DEMO.txt`. No es necesario registrarse; usar `demo.admin` y su contraseña de ese archivo. Los otros siete perfiles permiten probar las restricciones. Este archivo no contiene secretos de infraestructura y está excluido de Git. Los archivos originales privados de infraestructura siguen en `.local/`.

El servicio está en Free y la base Neon se verificó como Free; no se crearon recursos de pago. Las cuotas gratuitas y el reposo por inactividad siguen aplicando. URL pública y cuentas corresponden exclusivamente a DEMO.
