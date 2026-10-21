# HALO 3.0

Evolución visual incremental de HALO 1/2. No modifica servicios, permisos, DTOs, consultas, credenciales ni reglas de negocio.

- Atmósfera continua: un fondo CSS de gradientes amplios en el documento; tonos cielo, cálidos y tierra centralizados en `theme-tokens.css`. El contexto existente de área ajusta la intensidad cromática sin duplicar gradientes.
- Materiales: superficies base, suaves, glass, operativas y destacadas adaptadas a Claro/Oscuro. Tablas y formularios conservan fondo sólido. Glass selectivo, alternativa sin transparencia y sin blur en móvil.
- Inicio: saludo existente integrado al fondo; hasta cuatro portales tomados de las áreas ya filtradas. Conserva acciones, directorio y sidebar. Órbitas/núcleo/nodos reutilizados, nombres siempre visibles.
- Gráficos: `src/ui/charts.js` presenta agregados existentes con barras, donut de cobertura y líneas temporales. `chartsView` se comparte entre Panorama y análisis mensual. No consulta APIs ni calcula métricas de negocio. Una serie insuficiente no se grafica; sus valores existentes siguen disponibles.
- Accesibilidad: datos en enlaces y desplegables nativos, teclado/táctil, tooltips descartables con Escape, foco visible, movimiento reducido y colores forzados. Automático conserva el valor persistido `system`.
- Rendimiento: SVG/CSS nativos, sin nuevas dependencias, imágenes de fondo ni animaciones perpetuas. Se conserva la carga diferida del análisis mensual.

Verificación: `npm run test:halo3`, `npm run test:theme`, estados Skeleton y regresión de módulos. Capturas de prueba en `test-results/halo3/` (datos ficticios en bases aisladas). No existe compilación de frontend: el proyecto sirve módulos ES nativos; se verifican sintaxis y carga de recursos.

Límites: no inventa puntos para completar series; sin al menos dos observaciones no dibuja una tendencia. La visualización usa exactamente el alcance del DTO autorizado. Revisión visual final a cargo de Marcos y Valen; no iniciar otra fase.
