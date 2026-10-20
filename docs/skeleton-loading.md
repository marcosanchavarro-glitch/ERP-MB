# Skeleton loading

`src/ui/skeleton.js` exporta texto, avatar, tarjeta, métrica, fila de Persona y fila de tabla. `skeleton(kind, options)` compone patrones de tarjetas, lista, ficha, dashboard, tabla y gráfico. Las tablas reciben solamente encabezados conocidos y muestran cuatro filas por defecto, con un máximo de seis.

Los patrones utilizan formas neutras, tokens de superficie y radios existentes. No reciben registros, métricas, nombres ni datos de sesión. El contenedor indica `aria-busy`; las formas se ocultan a lectores de pantalla. El pulso es sutil y se desactiva con `prefers-reduced-motion`.

Cada consulta reemplaza el skeleton con sus datos, vacío o error, incluido acceso denegado. No se agregan demoras ni dependencias. Los filtros existentes se mantienen durante las consultas de filas. La Ficha contextual se abre inmediatamente con su patrón de ficha.

La navegación conserva shell, header y sidebar para la misma sesión. Un cambio de cuenta crea una estructura nueva y limpia los filtros de Personas y Células. Los esqueletos nunca se construyen con datos de la cuenta anterior.

Validación específica: `npm run test:skeleton` (requiere el runtime Playwright configurado, igual que las demás pruebas de navegador). Incluye respuestas de API controladas para datos, vacío, error y 403, cambio de cuenta, estabilidad del shell, temas, tamaños de pantalla y movimiento reducido.
