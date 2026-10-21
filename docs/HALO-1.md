# HALO 1 — identidad visual progresiva

HALO es la dirección visual y nombre de trabajo. No reemplaza `APP_NAME`, la
identidad de la organización, el favicon ni su logo configurado.

- `theme-tokens.css`: paleta central crema/terracota/tierra/ámbar/celeste,
  colores funcionales independientes, variantes cálidas claras y oscuras,
  roles tipográficos, superficies y gradientes radiales reutilizables.
- `halo.css`: shell, controles compartidos, ingreso e Inicio. Surface base,
  soft, glass, feature y operational tienen tokens y clases de composición.
  Glass solo en el selector de tema; sombras suaves en controles protagonistas.
- Archivo variable, Omnibus-Type, SIL OFL 1.1: una familia para cuerpo y display
  condensado mediante eje de ancho. Dos subconjuntos WOFF2 locales, 176344 bytes
  en total; licencia incluida. Datos y microetiquetas usan monospace del sistema.
  Fuente: https://github.com/google/fonts/tree/main/ofl/archivo
- Grain: SVG procedural embebido de 120 × 120, opacidad 0.045, limitado a
  superficies expresivas; sin textura ni gradientes sobre tablas/formularios.
- Inicio recibe la navegación ya filtrada y el usuario de sesión. Usa el nombre
  de cuenta disponible, sin nueva consulta ni ampliación del DTO de autenticación.
  Los accesos rápidos son enlaces a herramientas existentes; no concede acciones.
- Personas, Células, Asistencia y demás módulos conservan su composición anterior.
  Heredan paleta, fuente y shell. No cambia servicios, modelos, APIs ni seguridad.
- Skeleton se conserva; consume los mismos tokens. La geometría es CSS estático.
  Reduced motion desactiva animaciones y transiciones; navegación/foco conservados.

Validación: `node --test tests/halo.test.mjs tests/skeleton.test.mjs`,
`tests/halo-browser.mjs`, navegación, temas, autenticación y Asistencia.
Anchos 320/360/390/430/768/1440 y claro/oscuro/sistema. Capturas en
`test-results/halo1/`. El frontend usa módulos nativos: no hay etapa de bundling;
se valida sintaxis, carga de recursos y ejecución en el navegador.

HALO 2 y los rediseños operativos específicos quedan fuera de esta entrega.
