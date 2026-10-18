# Fase estética 1 — identidad global y temas

Identidad blanca y azul, sin variantes por área. Se conservaron layouts, componentes, rutas, permisos y lógica funcional. La migración cambia las declaraciones de color existentes, sin duplicar hojas completas para oscuro.

- `src/theme-tokens.css`: paleta semántica clara/oscura, superficies, interacción, texto, bordes, foco, overlays y estados success/warning/danger/info. `--accent`, `--muted` y `--line` son alias de compatibilidad; los colores nuevos se definen aquí. El acento de la identidad pública antigua ya no se inyecta sobre la paleta global.
- `src/theme-components.css`: controles nativos, selección, foco, hover/disabled y selector compartido. Las hojas de cada módulo mantienen su distribución y consumen tokens.
- `src/theme-init.js`: script externo del mismo origen, síncrono en el head antes de CSS, compatible con la CSP existente. Aplica la preferencia antes del primer render; no usa inversión, estilos inline ni solicitudes de configuración.
- `src/theme-control.js`: control Claro/Oscuro/Sistema en cabecera, login y portal del líder. Selección nativa accesible, foco visible, cierre por Escape y clic exterior.

## Preferencia y extensión

La instalación comienza en **Claro**. Se guarda exclusivamente `erp.theme` (`light`, `dark` o `system`) en localStorage del navegador, compartido por sus pestañas; no es una preferencia de cuenta ni agrega tablas o endpoints. Si el almacenamiento está bloqueado, el cambio sigue funcionando en la pestaña. Sistema observa `prefers-color-scheme` mientras está seleccionado. Cambiar tema no recarga ni reemplaza formularios.

Orden de extensión: tokens globales → claro/oscuro → futuros overrides de área → futuros overrides de subárea → componentes. `data-theme-area` y `data-theme-subarea` contienen los identificadores existentes de navegación; login los limpia. Una hoja futura, cargada después de los tokens, podrá sobrescribir variables sobre esos atributos y `data-theme`, sin editar componentes. En esta fase no existen paletas por área, editor de temas ni personalización por usuario.

Logo, nombres y favicon siguen usando la infraestructura de branding existente. El favicon predeterminado se actualizó a azul; no se reemplazan logos personalizados.

## Verificación

`npm run test:theme` usa Playwright, `PLAYWRIGHT_PATH`/`BROWSER_CHANNEL` y la misma base aislada de las pruebas existentes. Comprueba preferencia persistente, Sistema dinámico, cambio sin recarga ni pérdida de texto, sincronización entre pestañas, almacenamiento bloqueado, aplicación antes de CSS, teclado/Escape y contraste AA de pares semánticos.

Capturas en `test-results/theme`: login, inicio, Oficina, Personas, Ficha 360°, formulario, Células, reuniones/asistencia, Seguimiento, Administración, Calidad y Mi Célula en claro/oscuro, a 1440/390/320 y control adicional a 820. Las suites funcionales existentes permanecen separadas y completas.

Resultado final: **109/109 pruebas Node**, **10/10 suites funcionales de navegador** y **test de temas aprobado**, con 98 capturas y sin desbordamiento horizontal. Revisión visual de pantallas principales en ambos temas; contraste mínimo 4.5:1 en los pares semánticos de texto comprobados. Logs: `theme-final-node.log`, `theme-final-browser.log` y `theme-browser.log` en `test-results`. Health local: 200. Sin cambios de plan ni despliegue en Render durante esta fase.

No se implementó Fase Estética 2 ni se avanzaron fases funcionales durante este trabajo visual. Los cambios funcionales que ya existían al comenzar se conservaron; esta fase no realiza un despliegue funcional independiente.
