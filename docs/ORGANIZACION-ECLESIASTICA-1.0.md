# Organización Eclesiástica 1.0

Implementación local del 26 de octubre de 2026. Sin despliegue.

## Modelo y migración

La migración aditiva `019_ecclesiastical_organization.sql` crea un catálogo fijo de nueve cargos con identificadores estables, nombres, orden y estado activo. Orden oficial: Apóstol, Pastor interno, Anciano mayor, Anciano medio, Anciano, Líder celular, Líder areal, Asistente y Miembro. Un trigger impide agregar, editar o eliminar cargos durante esta fase.

`ecclesiastical_appointments` referencia a la persona existente en `people`: no hay otra base de personas. Conserva cargo, fecha efectiva, actor, fecha de registro, motivo e identificador de operación. Sus registros son inmutables. La vista `ecclesiastical_periods` calcula el final de cada período a partir del siguiente cambio; el último es el único vigente. Los intervalos son [inicio, siguiente inicio), sin superposición. Los cambios del mismo día se ordenan por secuencia y se conservan, incluso si un período tiene duración cero en días.

El backend bloquea la fila de persona en la transacción y compara el identificador de cargo esperado. Un reintento con el mismo identificador de operación y contenido no duplica el cambio; un conflicto conserva el formulario y exige actualizar la consulta. Fechas inexistentes, futuras, anteriores al cargo vigente, al nacimiento o a la incorporación registrada se rechazan. Los cambios y su auditoría se guardan de forma atómica.

## Incorporación y registros anteriores

No se realiza backfill ni se cambia retroactivamente el cargo de personas existentes. En una ficha **nueva**, la fecha de incorporación explícita existente (`joinedDate`) se toma como señal de incorporación formal para registrar Miembro como cargo inicial, con auditoría. El estado Activa por sí solo no asigna cargos.

Una persona nueva sin fecha de incorporación queda sin cargo; Recepción/Nuevos conserva su estructura separada y no genera cargos por visitar la iglesia. El alta formal de Nuevos reutiliza el flujo existente de creación en Matriz y su fecha de incorporación. Editar después la incorporación de una ficha anterior no le asigna un cargo automáticamente: requiere revisión y confirmación administrativa.

Una asignación explícita en Ficha 360° requiere confirmar la incorporación formal y el cambio. No modifica la fecha de incorporación de la persona ni otras reglas de Personas.

## Integraciones y permisos existentes

- Ficha 360° completa y contextual: pestaña Cargo eclesiástico, etiqueta neutral, fecha de inicio, historial paginado, actor, fecha registrada, motivo y acción Modificar cargo para usuarios autorizados. Actualización local sin navegar ni reconstruir el panel principal.
- Personas: filtro de cargo vigente o Sin cargo registrado, combinado con búsqueda, filtros y paginación actuales; el backend mantiene el alcance personal.
- Oficina → Datos fundamentales → Cargos eclesiásticos (`/oficina/cargos`): consulta administrativa de los nueve cargos, orden y conteos SQL reales. No permite editar la jerarquía. No traslada otros módulos ni define una central administrativa completa.
- Consulta de cargo: `personas.ver` y su alcance. Historial: `personas.historial` y su alcance. Modificación: permiso global existente `admin.usuarios.gestionar` **más** `personas.editar` para esa persona y acceso de lectura. Catálogo administrativo: `admin.usuarios.ver` global y acceso a Personas; conteos limitados al alcance de lectura.
- No se crean permisos nuevos ni se alteran roles, concesiones o asignaciones de acceso. El configurador SQL de runtime agrega solo lectura del catálogo/vista e inserción/lectura de cambios; no concede actualización ni eliminación del historial.
- Auditoría existente: `ECCLESIASTICAL_OFFICE_ASSIGN` y `ECCLESIASTICAL_OFFICE_CHANGE`, entidad PERSON, valores anterior/nuevo, fecha efectiva, actor y contexto de confirmación. CSRF y autorización se validan en backend.

## Independencia de las responsabilidades celulares

El cargo no consulta ni modifica `user_roles`, `user_permissions` o `cell_memberships`. Tampoco se actualiza al cambiar una pertenencia celular.

Casos para revisión administrativa, sin corrección automática:

- Cargo Líder celular sin liderazgo vigente en una célula concreta.
- Liderazgo celular vigente con otro cargo o sin cargo registrado.
- Fecha de incorporación corregida en Personas que resulte posterior a un cargo histórico.

Estas situaciones requieren verificar la realidad institucional; ninguna autoriza a inventar membresías, ascensos o permisos.

## Componentes y archivos principales

- Backend: `server/people/ecclesiastical.mjs`, integración localizada en el servicio, repositorio y router existentes de Personas; `server/db/runtime-grants.mjs`.
- Frontend: `src/people/ecclesiastical.js`, pestaña y filtro en componentes actuales de Personas y Ficha contextual, estilos HALO existentes.
- Navegación: catálogo actual, agrupación de Oficina y presentación filtrada del acceso. No se crea un segundo menú.
- Pruebas: `tests/ecclesiastical.test.mjs`, `tests/ecclesiastical-browser.mjs` y expectativas de catálogo/migraciones actualizadas en pruebas existentes.

## Validación

| Verificación | Resultado |
|---|---|
| Suite completa `npm test` | **218 aprobadas, 0 fallidas, 0 omitidas, 0 canceladas**, 355946 ms (5 min 56 s). Log: `test-results/ecclesiastical-full.log`. |
| Casos específicos de cargos, incluidos en la suite completa | **7/7 aprobados**, incluido un rol SQL restringido real, sin privilegios de propietario. |
| Pruebas dirigidas iniciales de cargos, Personas y navegación | **26/26 aprobadas**, antes de agregar el caso de runtime. Log: `test-results/ecclesiastical-directed.log`. No se suman como casos adicionales a la suite completa. |
| Navegador de cargos | **Aprobado**. Ficha completa/contextual, asignación, cambios, historial, filtro, catálogo, consulta limitada, seis anchos Light/Dark y formulario contextual a 390 px. Log: `test-results/ecclesiastical-browser.log`. |
| Regresiones de navegador | **3/3 scripts aprobados**: UX/UI, Personas y Nuevos, incluidos promoción formal y MapLibre fijo al cambiar tema. Logs: `test-results/ecclesiastical-{ux-ui,people,newcomers}-browser.log`. |
| Secretos y formato | Revisión heurística sin hallazgos y `git diff --check` sin errores. |

Las pruebas específicas cubren catálogo, orden, asignaciones, concurrencia, idempotencia, historial paginado, fechas, filtros combinados, conteos, autorización y alcance personal, CSRF, auditoría, rollback, integridad referencial, separación del liderazgo y del rol técnico y runtime SQL restringido. El navegador simula además la pérdida de una respuesta **después** de guardar en backend: conserva el formulario, no muestra éxito prematuro y reintenta sin duplicar historial. No se detectaron regresiones en el alcance probado.

En la validación inicial del navegador se corrigieron la etiqueta accesible del selector y la limpieza del aviso de éxito anterior al comenzar un nuevo cambio; los resultados anteriores corresponden a las ejecuciones finales.

Capturas de ejemplo: `test-results/ecclesiastical/light-1440.png`, `dark-390.png`, `form-390.png`, `catalog-1440.png` y `catalog-320.png`. Se inspeccionaron visualmente la ficha y el formulario móviles. No se realizó una auditoría humana completa con lector de pantalla.

## Límites y pendientes

- No se programan cargos futuros ni se editan/eliminan eventos históricos. Una rectificación institucional debe registrarse como un cambio nuevo; correcciones históricas excepcionales requieren un flujo posterior definido.
- No se habilita editar cargos oficiales ni su orden.
- Las fichas anteriores conservan Sin cargo registrado hasta revisión individual. No se infiere el cargo desde observaciones de texto, roles técnicos o células.
- Datos fundamentales queda definido únicamente para esta consulta; otras herramientas requieren su propia definición funcional.
- La migración se aplicó solo en desarrollo local. La demo publicada continúa con su versión anterior; no se realizó commit, push ni despliegue.
