# Fase transversal 0.5 — Usuarios, perfiles y accesos

Entrega local del 13 de octubre de 2026. Se construye sobre Identity 0.4 y conserva las fases funcionales hasta Seguimiento 1.5. El archivo de solicitud mencionaba 69 pruebas/7 suites; el estado real previo era **83 pruebas/8 suites**, ejecutadas antes de modificar y aprobadas.

## Uso

Entrar a **Administración → Usuarios** con una cuenta autorizada. Permite buscar, crear y abrir cuentas, vincular una Persona existente, activar/suspender, combinar perfiles, asignar permisos y alcances, consultar accesos efectivos, cerrar sesiones, restablecer credenciales y ver auditoría.

Desde la Ficha 360° de Persona aparece **Crear / habilitar usuario** o **Ver cuenta** cuando el operador tiene autorización administrativa. La Persona ya está seleccionada al abrir el formulario; no hay que volver a buscarla. Crear una cuenta nunca crea una Persona.

Se conserva el identificador `username`, normalizado a minúsculas y único, con las reglas anteriores de longitud y caracteres. Persona y Usuario siguen siendo entidades diferentes. `users.person_id` continúa siendo opcional y único: una Persona puede no tener cuenta; una cuenta puede no tener Persona vinculada. No se copiaron datos personales a `users`.

## Perfiles

| Perfil | Acceso inicial |
|---|---|
| Administrador General | Administración de usuarios, auditoría de cuentas, todas las áreas y permisos funcionales disponibles. |
| Apóstol | Permisos equivalentes al Administrador General, con identidad de perfil separada. |
| Oficinista | Personas completas, Células, Asistencia y Seguimiento. Sin administración de cuentas, configuración global ni Tesorería implícitas. |
| Usuario por áreas | Sin permisos automáticos amplios. Se eligen áreas, subáreas y permisos explícitos. |

Los perfiles se acumulan. El catálogo **Roles y permisos** permite consultar qué otorga cada perfil; sus asignaciones se administran desde cada Usuario. Los cuatro perfiles son políticas del sistema, no combinaciones creadas para cada conjunto de permisos. No se añadió un editor de perfiles arbitrarios.

Cuando una migración futura incorpora permisos funcionales nuevos, un trigger los asigna a Administrador General y Apóstol manteniéndolos separados. Oficinista solo incorpora permisos de Personas, Células, Asistencia y Seguimiento. Por ejemplo, un futuro permiso de Tesorería llega a ambos perfiles globales, pero no al Oficinista. Esto no implementa Tesorería ni otros módulos pendientes. El portal celular queda fuera de esa concesión general porque exige su habilitación específica y liderazgo vigente.

## Roles, permisos y alcance

Se conserva `roles → role_permissions → user_roles`. La tabla nueva `user_permissions` permite asignaciones explícitas, sin crear roles combinatorios.

Los permisos efectivos son la suma de perfiles/asignaciones previas y permisos explícitos. La ficha muestra su procedencia. No hay un modelo de denegación: desmarcar un permiso explícito no elimina lo que sigue concediendo un perfil; hay que retirar la fuente que lo otorga.

- **Global:** permiso sobre todo su dominio.
- **Persona:** UUID de una Persona existente, para permisos compatibles de Personas/Seguimiento.
- **Célula:** UUID de una célula existente, para permisos compatibles de Células/Asistencia.
- **Área/subárea:** ID estable del catálogo central para `modulos.acceder`.

Los permisos administrativos, de habilitación de portal y las altas de Personas/Células son globales. Backend rechaza combinaciones de permiso/alcance incompatibles, destinos inexistentes y duplicados. Los destinos por Persona/Célula se buscan en la interfaz; no hace falta escribir UUID.

El árbol de áreas se obtiene de `src/config.js`, con su iconografía existente. Seleccionar HDR → Universitarios no concede HDR completo, Pekes o Jóvenes. Seleccionar **Toda el área** sí incluye sus subáreas. Los contenedores visibles de navegación no equivalen a una concesión sobre toda el área. La navegación y los placeholders solo muestran enlaces autorizados.

Los accesos a módulos y los permisos sobre datos son distintos: seleccionar un área no concede por sí solo edición de Personas, asistencia o acceso administrativo. Las API funcionales existentes continúan verificando sus permisos y scopes. Para futuros módulos, `server/identity/modules.mjs` proporciona `assertModule` y `canModule`; deberán combinarse con los permisos funcionales de sus operaciones. `/api/modules/:id/access` verifica este alcance en backend. Los módulos pendientes siguen sin tener operaciones de datos.

## Liderazgo celular

La ficha permite **Habilitar portal según liderazgo vigente** y elegir si muestra indicadores de inasistencia. Al crear desde Persona, la habilitación aparece seleccionada; también se selecciona al vincular una Persona durante el alta. Es una autorización explícita visible en el formulario y puede retirarse. No exige asignar un perfil llamado Líder.

El alcance real se sigue derivando en cada petición:

`Usuario activo → Persona → membresía LEADER vigente → Célula activa`

No existe `user.cell_id`. Una habilitación sin liderazgo vigente no concede una célula. Un exlíder pierde el alcance y un traslado lo actualiza; los otros permisos de la cuenta se conservan. Asistentes no reciben alcance automático. El CLI anterior se mantiene compatible y al deshabilitar el portal retira también sus permisos explícitos. Una cuenta con otros accesos y sin célula vigente entra al espacio general; una cuenta exclusivamente de portal conserva el estado “sin célula asignada”.

## Seguridad y sesiones

Se reutilizan Argon2id, cookies HttpOnly/SameSite/Secure según entorno, PostgreSQL, CSRF, rate limiting y autorización por petición. No hay registro público ni otro login. No se incorporaron invitaciones, recuperación por email o MFA.

Permisos administrativos:

- `admin.usuarios.ver`: consulta de cuentas y catálogo.
- `admin.usuarios.gestionar`: alta, cambios, credenciales y sesiones; las rutas también requieren consulta.
- `admin.auditoria.ver`: auditoría de cuentas, junto con acceso a consulta de usuarios.

Las mutaciones requieren la contraseña actual del operador, además de sesión, permisos y CSRF. Tienen un límite de 20 operaciones por minuto y Usuario. La contraseña de destino mantiene el mínimo de 14 caracteres y máximo de 256. Se cifra usando la infraestructura anterior; nunca aparece en respuestas, auditoría o logs. Los formularios limpian credenciales al completar una operación.

Modificar una cuenta o sus accesos revoca sus sesiones. Suspender impide nuevos logins y retira acceso operativo; reactivar no restaura las sesiones antiguas. Restablecer contraseña también revoca sesiones. No se elimina Usuario para revocar acceso.

La ficha muestra sesiones vigentes con inicio y vencimiento y permite cerrarlas todas. La API admite también revocación individual con una referencia hash no utilizable como cookie. Nunca devuelve el identificador de sesión, CSRF de otra sesión ni su objeto completo. Se muestran hasta 50 sesiones.

La reautenticación y las mutaciones administrativas se serializan con un bloqueo transaccional, comprobando de nuevo al actor. Una versión de Usuario evita ediciones perdidas. No puede quedar el sistema sin una cuenta activa con consulta y gestión administrativa; una operación que quitaría al último administrador se revierte completa, incluida la revocación de sesiones. Esta protección corresponde a la API administrativa; un operador de base o CLI de recuperación continúa siendo una autoridad privilegiada.

## Auditoría

Se conserva `audit_events`, inmutable y transaccional. Altas, cambios de cuenta/accesos, contraseñas y revocaciones registran al Usuario operador. Los cambios incluyen estado, vínculo, perfiles, asignaciones conservadas y permisos; nunca contraseña ni hash Argon2.

La vista SQL `identity_audit` expone exclusivamente eventos cuya entidad es USER. El rol web recibe lectura sobre esa vista, no lectura global de auditoría. La pantalla **Auditoría de usuarios** y el historial de cada cuenta consultan esa política: no incluyen notas de Seguimiento ni auditoría pastoral. Los eventos anteriores de login/logout y CLI siguen disponibles. La paginación es de 20 eventos.

## Compatibilidad y migración

`008_identity_admin.sql` agrega versión/timestamp a Usuario, permisos explícitos, cuatro perfiles, permisos administrativos, política para futuros permisos y la vista de auditoría. No modifica migraciones anteriores, contraseñas, Personas, células ni asistencia.

Si existe exactamente un administrador CLI previo activo con rol global **Oficina administrativa**, la migración le agrega Administrador General y registra el bootstrap. No promociona automáticamente un conjunto ambiguo de oficinistas. Si hay varias cuentas administrativas heredadas, un operador autorizado debe crear una cuenta administrativa explícita mediante el CLI existente antes de usar esta interfaz. `admin:create` ahora usa el perfil Administrador General.

La interfaz conserva asignaciones previas cuando se seleccionan en su sección. Permite retirarlas de manera explícita, sin convertir automáticamente un rol con alcance limitado en uno global. La habilitación antigua de Portal líder se representa mediante los controles del portal al guardar.

Actualización local, con el servidor detenido:

```text
npm run db:migrate
npm run db:grant-local
npm run dev
```

En otros entornos, aplicar los privilegios equivalentes: SELECT/INSERT/UPDATE en `users`; SELECT/INSERT/DELETE en `user_roles` y `user_permissions`; SELECT en catálogo y `identity_audit`; permisos de sesiones existentes. Sin DELETE de Usuarios ni UPDATE/DELETE de auditoría.

No hay dependencias nuevas ni servicios externos. La versión del paquete es 1.5.1 para señalar la adición transversal 0.5 sobre la funcionalidad 1.5, sin avanzar a 1.6.

## Validación y límites

Antes de modificar: **83/83 pruebas Node y 8/8 suites de navegador aprobadas**. Resultado final: **94/94 pruebas Node y 9/9 suites de navegador aprobadas**, con 11 pruebas nuevas de backend y una suite nueva de navegador.

Pruebas específicas: perfiles distintos/equivalentes, Oficinista limitado, Persona única, username único, permisos por Persona, subáreas aisladas, permisos futuros de Tesorería, liderazgo combinado, baja de alcance, compatibilidad CLI, suspensión/reactivación, sesiones, contraseñas, CSRF, IDOR, última cuenta administradora, concurrencia, atomicidad y exclusión de secretos. Navegador: crear/ver desde Ficha 360°, árbol de subáreas, navegación permitida/denegada, suspensión, contraseña, revocación y 320/390/820/1440 px.

No se crearon cuentas reales de prueba en la base local. Las pruebas usan bases aisladas y cuentas temporales. Los formularios conservan datos ante errores y avisan antes de abandonar cambios; no persisten credenciales en localStorage. La búsqueda y paginación de cuentas son del servidor, 50 por página; los selectores devuelven hasta 30 coincidencias y permiten refinar la búsqueda.

Quedan fuera: editor arbitrario de perfiles, editor de configuración general, invitaciones, email/MFA, nuevos módulos funcionales y despliegue productivo. Se conservan los requisitos pendientes de operación segura descritos en Operación. **No se avanzó a 1.6.**
