# Territorio 1.5 — matriz de estado y estabilización

Evaluación local del 26 de octubre de 2026. No se realizó despliegue.

## Estado inicial comprobado antes de estabilizar

| Área | Estado | Evidencia y brechas |
|---|---|---|
| Modelo geográfico y sede | Implementado y probado | Migraciones 014–017, sede confirmada, sin coordenadas inventadas. |
| Mapa, marcadores y radios | Implementado y probado | MapLibre real en pruebas de navegador, cartografía simulada; estilo claro fijo y logo institucional separado. |
| Geocodificación de sedes/células | Implementado y probado localmente | Búsqueda explícita, caché, cuotas y confirmación; la clave privada de geocodificación sigue siendo una configuración independiente. |
| Recomendaciones 1.2 | Implementado y probado | Hasta tres células, edad/clasificación/proximidad, permisos y coordenadas confirmadas. La derivación desde Matriz es informativa. |
| Análisis 1.3 | Implementado y probado | Jerarquía, zonas/sectores, asignaciones auditadas, agregaciones SQL y densidad de la página actual; prueba de 5000 células. Sin polígonos inventados. |
| Evangelismo 1.4 | Implementado y probado en flujos principales | Migración 018; salidas, estados, participantes autorizados, GeoJSON manual, estadísticas y línea de tiempo; prueba integral en MapLibre real. |
| Integración de navegación | Parcial | Persisten opciones de Territorio planificadas que conducen a placeholders. Deben ocultarse de la navegación ordinaria. |
| Arranque ante recursos fallidos | Parcial | El HTML inicial tiene un contenedor vacío; si falla la descarga del módulo principal puede no aparecer recuperación. |
| Estadísticas sin consulta de salidas | Parcial | Debe verificarse que las leyendas no ofrezcan acciones de detalle sin acceso a salidas. |
| Recuperación y revocación | Parcial | Revisar limpieza de datos visibles, respuestas tardías y actualización de capas ante fallos o pérdida de acceso. |
| Verificación remota | Bloqueada por el entorno durante la comprobación | La demo respondió HTTP 503 tanto en Edge normal como en HTTP/1.1. No confirma la causa del fallo HTTP/2 reportado anteriormente. |

## Límites funcionales deliberados

- Los radios son áreas de referencia, no prueba de atención pastoral o evangelismo.
- La densidad utiliza células activas confirmadas de la página actual (hasta 500).
- Un recorrido manual no prueba que se caminó; no se solicita GPS del dispositivo.
- Las participaciones agregadas no son personas únicas.
- La derivación efectiva de Personas a Células y los polígonos territoriales no se
  incorporan dentro de esta estabilización.

## Correcciones confirmadas

| Problema y causa | Corrección |
|---|---|
| El catálogo conservaba hijos planificados de Territorio y el inicio del área utilizaba el placeholder genérico. | La presentación filtra las herramientas no implementadas. El inicio enlaza únicamente las herramientas reales autorizadas; sedes/células permanecen dentro del mapa y zonas/sectores dentro de análisis. |
| El HTML inicial tenía el contenedor vacío y dependía de que todos los imports llegaran. | Estado inicial visible, alternativa sin JavaScript y recuperación independiente del módulo principal; botón de recarga manual que conserva la URL. No se implementan reintentos infinitos. |
| Leyendas de estadísticas podían ofrecer enlaces de salidas a un usuario autorizado únicamente para estadísticas. | Leyendas informativas sin enlaces cuando falta consulta de salidas; el backend continúa validando cada operación. |
| Respuestas de detalle o recorridos podían terminar después de cambiar filtros o cerrar un detalle. | Se descartan respuestas obsoletas. Un 403 de consulta elimina datos, borradores y capas; los fallos de red muestran error y permiten reintentar sin dejar un skeleton permanente. |
| La comprobación de privilegios SQL no incluía las tablas nuevas de 1.3 y 1.4. Las pruebas con propietario no detectaban ese fallo de producción. | Se amplía el configurador existente de privilegios mínimos: lectura/escritura en tablas operativas, borrado solo en vínculos de participantes y eventos solo de lectura/inserción. Prueba real con rol SQL restringido, sin privilegios de propietario. |
| Dependencia transitiva body-parser 2.3.0 con aviso de denegación de servicio confirmado por npm audit. | Actualización compatible a 2.4.0 y qs 6.16.1 en el lockfile. Errores de contenido comprimido inválido devuelven 400 y el servidor sigue saludable. Ninguna dependencia funcional nueva. |

Aviso primario de seguridad: [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828).
La vulnerabilidad no demuestra la causa del incidente de carga reportado.

## Archivos y componentes principales

- Integración: `src/app.js`, `src/components.js`, `src/navigation-presentation.js`, `server/identity/presentation.mjs`.
- Recuperación: `index.html`, `src/startup.js`, `src/theme-components.css`.
- Mapa compartido: `src/territory/controller.js`, `maplibre-canvas.js`, `map-canvas.js`; no cambia proveedor ni estilo.
- Evangelismo 1.4: migración `018_evangelism.sql`, `server/territory/evangelism-*.mjs`, `src/domain/evangelism.js`, `src/territory/evangelism-*.js`, estilos y etiquetas administrativas existentes.
- Estabilización: `server/db/runtime-grants.mjs`, `server/http.mjs`, `src/territory/organization.js`, `src/ui/charts.js`, `package-lock.json` y pruebas dirigidas.

## Estado final por fase

| Fase | Estado local y alcance probado | Límites pendientes |
|---|---|---|
| 1.0 | Implementado y probado: modelo de ubicaciones, sede y coordenadas confirmadas. | Sin límites geográficos inventados. |
| 1.1 | Implementado y probado: mapa, pines, radios en metros, sede inicial y regreso, filtros, selección, recuperación y estilo OSM Bright fijo. | Las pruebas automatizadas usan MapLibre/worker reales con cartografía simulada; no certifican detalle o disponibilidad del proveedor real. |
| 1.2 | Implementado y probado: Ficha 360°, clasificación estructurada, edad y distancia con hasta tres recomendaciones, acceso combinado y confirmación manual auditada. | Derivación efectiva no implementada; geocodificación externa de domicilios personales no habilitada. |
| 1.3 | Implementado y probado: jerarquía, zonas/sectores, asignación de células, filtros, agregaciones SQL, presencia y densidad. | Densidad de página actual hasta 500 células; sin polígonos territoriales. No representa cobertura pastoral efectiva. |
| 1.4 | Implementado y probado: salidas, edición, estados, responsables, participantes existentes autorizados, trazados manuales, historial, comparación, estadísticas y línea de tiempo. | Sin seguimiento GPS ni localización individual; listado paginado de 20, capa de 50 recorridos por período y gráficos acotados explícitamente. |
| 1.5 | Integración y estabilización verificadas localmente: 211/211 casos y siete scripts de navegador aprobados. | No desplegado ni validado en producción con estas modificaciones. |

## Seguridad e integridad

La autorización efectiva se valida en backend en cada endpoint. Evangelismo separa consulta, creación, edición, estados, recorridos y estadísticas. Los participantes vinculados requieren el acceso existente a Personas y respetan su alcance; no se muestran domicilios ni coordenadas personales en estadísticas. Consultar Evangelismo por sí solo no entrega células ajenas al acceso territorial existente.

Las modificaciones se guardan junto con auditoría y eventos en transacciones; se prueban rollback, versiones concurrentes, integridad referencial y protección de eventos. No existe eliminación de auditoría desde la interfaz. El cargo eclesiástico de una ficha no asigna permisos. Se conserva la política previa de perfiles técnicos, sin crear asignaciones automáticas nuevas basadas en cargos.

La migración 018 es aditiva y se aplicó al desarrollo local, junto con los privilegios de ejecución, comprobando previamente host y puerto locales. No se tocaron registros de producción ni credenciales.

## Rendimiento y accesibilidad

- Agregaciones estadísticas en SQL, sin descargar Matriz ni un recorrido por cada tarjeta. Geometrías únicamente en capa o detalle autorizado, con límites explícitos.
- Una sola instancia del mapa durante selección, filtros, pestañas locales y cambios de tema; prueba de cámara y número de cargas de estilo. El mapa se carga de forma diferida y no se geocodifican direcciones confirmadas al cambiar filtros.
- Medición local previa de análisis: 5000 células en una agregación, 41,8 ms. Es una medición diagnóstica, no una garantía de producción.
- Pruebas de controles por teclado, foco, etiquetas, alternativa textual al mapa, formularios y coordenadas editables sin dibujo; movimiento reducido y seis anchos: 320, 360, 390, 430, 768 y 1440 px, claro/oscuro.
- No se realizó una auditoría humana completa con lector de pantalla ni una prueba de carga concurrente de producción.

## Incidente remoto de carga

En dos comprobaciones la demo devolvió HTTP 503 tanto con Edge normal como forzando HTTP/1.1. Después, `/health/ready` y `/` respondieron 200, y ambos modos cargaron el login sin errores de página ni solicitudes fallidas. No se reprodujo una causa específica de HTTP/2.

Render conservaba el servicio Free, sin suspensión, y el despliegue publicado anterior (`17e0f1c`). No aparecieron eventos de fallo/reinicio/suspensión ni errores recientes en la consulta realizada. La memoria observada fue aproximadamente 70 MiB de 512 MiB y CPU baja; esas muestras no explican un incidente histórico. No se atribuye el problema a Geoapify, falta de memoria o protocolo sin evidencia.

La recuperación nueva mejora el comportamiento ante recursos fallidos; no corrige una indisponibilidad del proveedor de alojamiento ni está publicada todavía.

## Verificaciones y resultados

| Verificación | Resultado final |
|---|---|
| `npm test`, suite completa después de la última corrección de privilegios SQL | **211 aprobadas, 0 fallidas, 0 omitidas, 0 canceladas**, 389064,7 ms (6 min 29 s). Log: `test-results/territory15-full-final.log`. Incluye migraciones, backend, frontend puro, permisos, auditoría y regresiones de Oficina/Células. |
| Evangelismo dirigido | 6/6 aprobadas; incluidas también en la suite completa. |
| Estabilización dirigida, incluido rol SQL restringido | 4/4 aprobadas; incluidas también en la suite completa. Log: `test-results/territory15-runtime.log`. |
| Navegador: siete scripts dirigidos | 7 aprobados, 0 fallidos en ejecución final. |
| `npm audit --omit=dev` después de la actualización | 0 vulnerabilidades conocidas. Log: `test-results/territory15-npm-audit-final.json`. |
| Revisión heurística de secretos y `git diff --check` | Sin hallazgos ni errores de formato. |

La primera ejecución general también terminó con 211/211. Se repitió completa para cerrar expresamente después de la corrección SQL. En pruebas dirigidas anteriores se corrigieron el alias SQL de mes, la comparación de períodos, la clasificación HTTP de compresión inválida y una espera del test de cámara. Los resultados finales anteriores sustituyen esas ejecuciones intermedias; no se suman las mismas pruebas repetidas.

Pruebas de navegador dirigidas aprobadas: mapa MapLibre, mapa alternativo, análisis, recomendaciones, Evangelismo, scroll y recuperación de inicio. Son siete scripts; sus escenarios internos no se cuentan como casos de `node:test`.

En Evangelismo se verificaron además red abortada y reintento, respuesta de detalle tardía descartada y limpieza ante 403. Se corrigió una espera de la prueba para medir la cámara después del encuadre solicitado; no se añadió restauración artificial del mapa.

Evidencia en `test-results/territory15-*.log`; capturas móviles y de escritorio de Evangelismo en `test-results/evangelism/`, capturas de recuperación en `test-results/territory15/`. Las capturas de mapas de prueba muestran cartografía simulada.

## Pendientes y preparación para desplegar

- **Bloqueantes de publicación:** no hay autorización para desplegar. Antes de publicar deben revisarse respaldo y ejecución de migraciones 016–018 en el entorno destino; aplicar el configurador actualizado de privilegios, ya integrado al arranque de Render. No se ejecutó esa operación remota.
- **Importantes:** causa histórica de los 503/HTTP/2 sin determinar; comprobar cartografía real y flujos con datos/perfiles de demo después de un eventual despliegue autorizado. Geocodificación privada de sedes/células requiere su clave de backend independiente si se desea usar esa búsqueda; la confirmación manual existente sigue disponible.
- **Mejoras futuras / límites funcionales:** derivación efectiva de Personas, geocodificación externa de domicilios personales bajo aprobación expresa, límites territoriales verificables, visualizaciones por encima de los límites documentados y evaluación humana con lector de pantalla. No se incorporaron nuevas fases.

**Preparación técnica local:** apta para preparar una entrega del alcance implementado, sin pruebas críticas fallidas ni bloqueantes de código detectados. Quedan las condiciones operativas de publicación y las limitaciones declaradas. No se declara operativa en la demo esta versión, ni se declara completa una derivación que sigue pendiente. No se realizó commit, push ni despliegue, y no se avanzó otra fase.
