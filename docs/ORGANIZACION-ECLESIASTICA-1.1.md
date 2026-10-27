# Organización Eclesiástica 1.1 — estructura y responsabilidades

26 de octubre de 2026, America/Buenos_Aires. **Implementación y migración locales; no desplegada.** La versión publicada previamente conserva Territorio, UX/UI y Organización Eclesiástica 1.0, commit `b2b2317`.

## Inspección y decisiones

Personas y Ficha 360° ya existen; la fase 1.0 utiliza `ecclesiastical_offices` y `ecclesiastical_appointments`. La navegación contiene áreas/subáreas técnicas y Administración → Áreas sigue siendo un destino planificado. Los alcances de acceso y `cell_memberships` representan autorizaciones y funciones celulares, no participaciones ministeriales. No había una entidad organizativa compatible que pudiera reutilizarse como registro de áreas y responsabilidades.

Se reutilizan `people`, los permisos administrativos, el mecanismo de auditoría, el router/API de Personas, Ficha contextual, el espacio existente de la pestaña Áreas, Datos fundamentales, encabezados, estilos, skeletons y protección de layout. No hay otra base de personas ni otro catálogo de cargos eclesiásticos.

## Modelo y migración 020

- `organizational_units`: UUID estable, nombre, descripción, área superior opcional, estado, versión, fechas y actores de creación/modificación; `catalog_key` identifica el origen inicial y no concede acceso al módulo equivalente.
- `organizational_assignments`: referencias a Personas y área, responsabilidad escrita por el administrador, clave normalizada para detectar equivalencias, marca independiente de responsable de área, inicio/final opcional, observaciones, actores y versión.
- `organizational_events`: historial inmutable, operación idempotente, actor, fecha y valores anteriores/posteriores. Las operaciones administrativas también registran su evento en `audit_events` dentro de la misma transacción.

Los períodos son [inicio, final), sin superposición de asignaciones idénticas. Una persona puede tener distintas funciones en una misma área y participar en varias; un área admite varios responsables. Modificar una responsabilidad cierra su período y crea otro, sin reescribir el anterior. Finalizar conserva el registro; no hay eliminación física desde la aplicación. Un trigger permite únicamente el cierre del registro vigente y protege el historial.

La jerarquía tiene FK, prevención de ciclos y no permite activar un hijo bajo un padre inactivo ni desactivar un padre con hijos activos. No existe un límite de profundidad de negocio. Las escrituras usan un bloqueo transaccional compartido para validar ciclos y períodos de forma consistente ante concurrencia; no se necesita una extensión ni una biblioteca nueva.

## Inicialización verificada

Se verificaron los nombres y las relaciones contra `src/config.js` y las migraciones existentes. Se inicializan ocho áreas conocidas: HDR, Música y Sonido, Multimedia, Recepción, HDR Arte, Limpieza, Oficina Manantial y Comedor. Multimedia tiene las cinco subáreas ya configuradas: Pantalla, Transmisión, Fotografía, Redes y Diseño.

Son **13 registros organizativos**, sin asignaciones de personas. La migración y los campos `system:catalog-020`, fecha y clave de origen documentan esta inicialización; las posteriores creaciones y modificaciones administrativas registran auditoría completa. No se supone que el catálogo sea definitivo ni se agregan otros departamentos para completar el organigrama. Cambiar el catálogo técnico en el futuro no cambia automáticamente estas entidades.

Las denominaciones LEADER/ASSISTANT/MEMBER existentes son funciones celulares y los nueve cargos de 1.0 son otra estructura. No se reutilizaron como responsabilidades ministeriales. Tampoco se convirtió la lista orientativa Responsable/Coordinador/Colaborador/Integrante en un catálogo obligatorio: las denominaciones se registran expresamente y los filtros sugieren las efectivamente utilizadas. La marca Responsable de área admite responsabilidades compartidas y no se infiere por el nombre escrito.

## Interfaz e integraciones

- **Oficina → Datos fundamentales → Áreas y departamentos**, `/oficina/areas`: listado paginado, búsqueda, estado, creación/edición, relación superior y activación/desactivación. El destino técnico planificado `/administracion/areas` se oculta para evitar un segundo acceso que conduzca a una pantalla vacía.
- **Detalle de área**, `/oficina/areas/:id`: información general, área superior enlazada, integrantes y responsables vigentes con conteos SQL reales, participaciones anteriores paginadas y actividad estructural reciente. Las personas abren la Ficha contextual existente; las asignaciones se administran desde su ficha.
- **Organigrama**: enlaces por teclado, niveles visuales y ruta completa de ascendencia. La sangría visual se limita en pantallas pequeñas para conservar legibilidad; eso no limita la jerarquía almacenada ni elimina la ruta. No interpreta relaciones de autoridad entre personas.
- **Ficha 360° completa/contextual → Áreas y responsabilidades**: reutiliza la pestaña antes planificada; incorpora, modifica o finaliza participaciones, muestra períodos y eventos históricos paginados. Las finalizadas se identifican expresamente; el estado del área tiene una etiqueta separada.
- **Personas**: filtros combinables de área, responsabilidad y participación. Se conservan búsqueda, orden y paginación. Los filtros históricos respetan el permiso de historial; sus opciones tampoco revelan funciones históricas no autorizadas.
- Actualizaciones locales después de confirmar el backend, formularios protegidos frente a navegación accidental, controles congelados durante guardado, errores conservando el borrador y número de operación persistente para reintentos.

## Seguridad

No se crean permisos nuevos. Leer la administración organizativa exige `admin.usuarios.ver` global y lectura de Personas; sus cifras e integrantes se limitan a las personas consultables. Crear/editar áreas exige además `admin.usuarios.gestionar`. Cambiar una participación exige el permiso administrativo de gestión y `personas.editar` para esa persona, junto con acceso de lectura. Consultar responsabilidades de una ficha usa `personas.ver`; el historial requiere `personas.historial` sobre esa persona.

Se validan UUID, tipos, longitudes, fechas, estados, parentescos, versión, idempotencia y CSRF en backend. Los endpoints de participación vinculan siempre el identificador de asignación con el identificador de persona autorizado. Se probaron IDOR, intentos sin permisos y rollback de auditoría. El rol SQL de ejecución puede operar únicamente las tablas necesarias y no borrar asignaciones ni modificar/eliminar eventos.

Una pertenencia organizativa no cambia `user_roles`, `user_permissions`, cargos eclesiásticos ni células. No se crea una cadena personal de autoridad a partir del árbol de áreas.

## Pruebas y resultados

| Verificación | Resultado |
|---|---|
| Suite completa `npm test` | **225 aprobadas, 0 fallidas, 0 omitidas, 0 canceladas**, 364268 ms (6 min 4 s). `test-results/organization-full.log`. |
| Casos específicos de organización | **7/7 aprobados**, incluidos en la suite completa; revalidación dirigida con protección de opciones históricas: `test-results/organization-directed-final.log`. |
| Navegador de organización | **Aprobado**: CRUD, organigrama y teclado, borrador protegido, asignación múltiple, cambios/finalización/historial, filtros, Ficha completa/contextual, usuario limitado y seis anchos claro/oscuro. `test-results/organization-browser.log`. |
| Regresiones de navegador | **4/4 scripts aprobados**: cargos 1.0, UX/UI con MapLibre fijo, Personas y scroll. `test-results/organization-{ecclesiastical,ux-ui,people,scroll-stability}-browser.log`. |
| Secretos y formato | Revisión heurística sin hallazgos; `git diff --check` sin errores. |

En total son **cinco scripts de navegador**, separados del conteo de `node:test`. Se comprobó 320, 360, 390, 430, 768 y 1440 px, además del formulario contextual móvil. Se inspeccionó el organigrama a 320 px. La espera de la prueba de participaciones anteriores se ajustó para comprobar los registros después de terminar la consulta, sin cambiar el comportamiento de la aplicación.

Capturas: `test-results/organization/light-1440.png`, `dark-390.png`, `form-390.png`, `chart-1440.png` y `chart-320.png`. Los registros Servicio de prueba y las personas de esas capturas pertenecen únicamente a bases aisladas de pruebas, eliminadas al terminar.

## Límites, pendientes y publicación

- Desactivar un área conserva sus relaciones, participaciones e historial; no finaliza personas automáticamente. No admite nuevas asignaciones hasta reactivarla.
- No se programan fechas futuras ni se editan períodos finalizados. La corrección ordinaria se registra como una nueva responsabilidad/período; rectificaciones históricas excepcionales necesitan un flujo definido.
- El listado de áreas y las participaciones del detalle usan páginas de 20. El organigrama y los selectores cargan hasta 2000 áreas, con aviso explícito; una ficha muestra hasta 500 participaciones y su historial de eventos es paginado. La actividad estructural del detalle muestra los 20 cambios recientes; la auditoría completa se conserva.
- No se realizó una evaluación humana completa con lector de pantalla ni una prueba de carga concurrente a escala de producción. No se instaló una biblioteca de diagramación ni servicios pagos.
- Queda la revisión administrativa de la estructura inicial y el registro de las participaciones reales. No se asignaron personas por inferencia ni se migraron roles técnicos a responsabilidades.
- **Preparación:** alcance implementado y validado localmente, sin fallos críticos detectados. Migración 020 y privilegios aplicados solo al desarrollo local. Publicar esta fase requiere autorización y la verificación del entorno destino; no se realizó commit, push ni despliegue de 1.1.
