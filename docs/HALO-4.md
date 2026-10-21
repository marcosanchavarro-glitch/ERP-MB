# HALO 4.0

Refinamiento visual y de UX sobre HALO 3. Sin cambios en backend, permisos, modelos, asignaciones, membresías ni reglas de negocio.

- Inicio conserva el saludo y la atmósfera. Se retiraron la bienvenida extensa, numeraciones, directorio repetido y accesos equivalentes.
- Los portales parten de la navegación ya filtrada. Presentan herramientas disponibles por área; las adicionales se agrupan en un desplegable nativo. Las secciones futuras continúan en su navegación habitual, sin presentarlas como herramientas operativas de Inicio.
- Las geometrías decorativas SVG distinguen personas, células, presencia, etapas, ondas, progreso y órbitas. No representan cifras ni funciones nuevas.
- El resumen reutiliza `/api/office/dashboard` y su DTO autorizado: acciones existentes, hasta tres bloques con pendientes y tres movimientos recientes. No solicita datasets completos ni el endpoint personal de contactos. Abrir/cerrar el menú no vuelve a consultar datos.
- El montaje y cancelación reutilizan el controlador de Oficina. Errores y respuestas incompletas se muestran con reintento; no se convierten en estados exitosos ficticios. Si no hay contenido, el bloque no se presenta.
- Datos opcionales de portales y saludo se validan como texto. Mi Célula tiene descripción visual propia y conserva el estado vacío neutral y compacto implementado anteriormente.
- Encabezados operativos más contenidos; materiales, atmósfera Light/Dark, tipografía, gráficos y menú compartidos. El salto al contenido mueve el foco sin modificar la ruta SPA.
- Donuts existentes de cobertura y asistencia registrada se conservan visibles. Seguimiento sigue pendiente de agregados globales por estado; no se calculan sobre una página parcial ni se crean endpoints.

Validación reproducible: `npm run test:halo4`, pruebas de tema y regresión funcional. Capturas en `test-results/halo4/`, con bases y cuentas aisladas. Frontend ES nativo: validación de sintaxis/carga de recursos y despliegue; no hay compilación de frontend.

No se implementaron Mi Perfil, nuevas áreas ni correcciones históricas de Células. Detenerse para revisión.
