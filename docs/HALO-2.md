# HALO 2 — expansión transversal

La presentación usa el contexto de área/subárea ya existente. No agrega temas
independientes, fuentes, datos ni permisos. No hay cambios de API, DB o reglas.

- `ui/halo.js`: backdrop con tono/intensidad/posición/variante acotados; órbita
  compartida, decorativa o progreso numérico; selección de clases glass.
- `theme-tokens.css`: superficies de tinta/papel, acciones según tema, glass
  dark/light/warm/neutral/feature y gradientes ember/lumen/skyline. Estados
  success/warning/danger/info conservan sus tokens y significado.
- `halo-modules.css`: presentación expresiva/intermedia/operativa. Oficina y
  Mi Célula mezclan tinta, terracota y superficies cálidas. Personas, Células,
  Asistencia e Importador usan cabeceras suaves con cuerpos sólidos. HDR y
  Formación usan luz; Multimedia, atmósfera oscura; Administración, precisión.
- Glass con fondo sólido de respaldo; blur solo en superficies contextuales.
  En móvil se usa el respaldo sólido para reducir capas y coste de composición.
- Sidebar oscura estable; botones de tinta sobre crema y cálidos en oscuro.
  Los estados destructivos mantienen danger. Geometría estática, sin WebGL ni
  nuevas imágenes. Grain sigue limitado a las superficies expresivas de HALO 1.
- Meta y anillo de Oficina usan los valores existentes, con porcentaje visual
  acotado. Se conserva el progress accesible y los formularios/acciones originales.
- Ficha, modales, vacíos, skeleton y gráficos heredan superficies, bordes y paleta.
  No se reconstruyen tablas ni formularios.

Validación: `npm run test:halo2`, suite de temas y regresiones operativas.
Capturas en `test-results/halo2/`. Anchos 320/360/390/430/768/1024/1600;
claro, oscuro y sistema; zoom, teclado, foco y movimiento reducido.
El proyecto usa módulos nativos: se comprueba sintaxis y carga de recursos,
sin introducir un bundler.

Formación, HDR, Multimedia y otras áreas previstas mantienen únicamente sus
vistas existentes; esta fase no implementa sus funcionalidades pendientes.
Las pantallas de gran densidad podrán recibir ajustes específicos tras revisión.
