# HALO — UX/UI 1.1: auditoría de navegación

Revisión local del 26 de octubre de 2026 (America/Buenos_Aires).

## Matriz de estado comprobado

| Observación | Estado | Evidencia |
|---|---|---|
| Barra lateral de Oficina | Implementado | Tres grupos: Trabajo diario, Comunidad y Datos y revisión. Se conservan las rutas y todos los accesos recibidos del sistema. Los grupos vacíos se omiten y no se duplican enlaces. |
| Datos fundamentales | Requiere definición funcional | No existe una pantalla inventada ni una ruta vacía. Las opciones y el propósito pendiente están documentados en `UX-UI-1.0-DATOS-FUNDAMENTALES.md`. |
| Descripciones breves | Implementado | Catálogo compartido de descripciones de Oficina y Territorio, tarjetas de Inicio y encabezados existentes. `pageTitle` reutiliza la jerarquía visual y omite párrafos vacíos. |
| Barra superior simplificada | Implementado | Navegación, contexto de pantalla, usuario, cierre de sesión y apariencia. Sin buscador ni avisos inactivos; identidad HALO independiente del logo institucional. |
| Switch claro/oscuro | Implementado | Cápsula horizontal, indicador circular, SVG sol/luna, desplazamiento de izquierda a derecha y transición de 240 ms. Control táctil de 44 px, `role=switch`, estado anunciado, foco visible y teclado. Se conserva la preferencia Automático. |

## Cambios de esta revisión

Solo se agregó este informe. Las cuatro correcciones definidas ya estaban presentes en la implementación local de UX/UI 1.0; no fue necesario reescribir componentes ni alterar código funcional.

No se cambiaron permisos, reglas de negocio, rutas, dependencias, datos ni credenciales. «Datos fundamentales» permanece pendiente del propósito y las herramientas que debe reunir; las alternativas existentes no se trasladaron arbitrariamente.

## Componentes reutilizados

- `src/navigation-presentation.js`: agrupación de Oficina y descripciones compartidas.
- `src/components.js`: sidebar, topbar, tarjetas de Inicio y `pageTitle`.
- `src/theme-control.js`, `src/theme-init.js` y `src/theme-components.css`: switch, persistencia, preferencia del sistema, resolución antes de CSS y movimiento reducido.
- Navegación móvil y manejo de foco existentes en `src/app.js`.
- MapLibre y controles actuales de Territorio. El tema no cambia OSM Bright, no crea otra instancia y conserva cámara y selección.

## Pruebas y evidencia

| Ejecución | Resultado |
|---|---|
| En esta revisión: `tests/ux-ui.test.mjs`, `tests/identity-cartography.test.mjs`, `tests/navigation.test.mjs` | **12 aprobadas, 0 fallidas, 0 omitidas**. Log: `test-results/ux-ui11-directed.log`. |
| En esta revisión: `tests/ux-ui-browser.mjs`, Edge con MapLibre/worker reales y cartografía simulada | **1 script aprobado**, sin errores de página. Log: `test-results/ux-ui11-browser.log`. |
| Suite general más reciente sobre el mismo código de aplicación, al cerrar Territorio 1.5 | **211 aprobadas, 0 fallidas, 0 omitidas**. Log: `test-results/territory15-full-final.log`. No se repitió en esta revisión documental. |
| Regresión de temas ya ejecutada | Aprobada: Claro/Oscuro/Sistema, persistencia, sincronización entre pestañas, resolución previa a CSS, almacenamiento bloqueado y contraste AA en las pantallas comprobadas. Log: `test-results/ux-ui-theme-regression.log`. |
| Regresión de scroll ya ejecutada al cerrar Territorio 1.5 | Aprobada: nodos persistentes, scroll del documento y del menú, filtros y paginación; escritorio y móvil. Log: `test-results/territory15-scroll-stability-browser.log`. |

La prueba de navegador de esta revisión comprobó permisos de administrador y usuario limitado, rutas conservadas, grupos por teclado, borrador de login conservado al cambiar tema, Space/Enter, persistencia tras recarga, modo Automático, movimiento reducido, ausencia de nuevas consultas al cambiar tema, menú móvil con Escape y seis anchos en claro/oscuro: 320, 360, 390, 430, 768 y 1440 px. En Territorio conservó instancia, estilo, centro, zoom y selección. La prueba de Evangelismo del cierre 1.5 también verificó sus recorridos al cambiar tema; esta revisión no modifica ese módulo.

Capturas regeneradas: `test-results/ux-ui/light-1440.png`, `dark-1440.png`, `light-390.png`, `dark-390.png` y `menu-390.png`. Se inspeccionó la captura móvil del menú. No se detectaron regresiones dentro del alcance probado. Estas pruebas no equivalen a una auditoría humana completa con lector de pantalla ni certifican la disponibilidad del proveedor cartográfico real.

## Pendientes y publicación

- Definir el propósito y las herramientas de «Datos fundamentales» antes de implementarlo.
- Los cambios comprobados siguen siendo locales. La publicación solicitada previamente no había llegado a commit, push ni despliegue cuando ingresó este pedido con la restricción «No desplegar». Quedó en espera y no se modificó Render.

No se avanzó otra fase.
