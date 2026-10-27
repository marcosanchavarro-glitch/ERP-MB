# HALO — Inicio 2.0

Implementación local. **No desplegada.** No se cambiaron credenciales, roles, membresías, asistencia, Territorio ni reglas de negocio.

## Diagnóstico del Inicio anterior

La ruta `/` renderizaba `home()` en `src/components.js` y, únicamente al encontrar Dashboard de Oficina en la navegación, montaba un resumen de Oficina. El resumen embebido omitía indicadores en cero, mostraba hasta tres widgets con pendientes y podía ocultarse por completo. Los usuarios sin ese destino recibían principalmente portales de navegación. No había un resumen general de Personas/Células ni integración departamental o personal para cada perfil. Algunos líderes eran redirigidos automáticamente desde Inicio hacia Mi Célula.

Se confirmaron limitaciones funcionales y de composición; no se reprodujo una excepción JavaScript general ni se comprobó que todos los enlaces anteriores fueran inactivos. El nuevo Inicio usa una selección acotada de destinos funcionales existentes y elimina los portales editoriales anteriores. La navegación normal permanece disponible.

## Implementación y fuentes

- Bienvenida con el identificador de usuario disponible en la sesión; saludo neutro si falta. La sesión actual no dispone de un nombre público independiente del usuario. No se consulta una ficha personal para ampliar el saludo.
- `/api/home` exige sesión y calcula las fuentes autorizadas en el backend. No acepta identificadores de usuario, célula o departamento para ampliar el alcance.
- Indicadores: Personas registradas dentro del alcance, células activas autorizadas, áreas/departamentos activos, actividades departamentales próximas y casos de seguimiento pendientes. Cero es un resultado real y permanece visible.
- Pendientes: contrato existente de Dashboard de Oficina, incluidas reuniones registradas sin cargar, seguimiento, Nuevos, citas, cumpleaños y calidad según los permisos existentes. No se crean tareas ni se cambian sus criterios. Sin pendientes de una fuente consultable se muestra un estado discreto.
- Actividad reciente: proyección autorizada existente de Oficina y eventos específicos de actividades departamentales. Se muestran tipos, fechas y enlaces; no se devuelve la auditoría general, notas privadas, credenciales ni participantes.
- Próximas actividades: Organización 1.2 fue verificada en el repositorio y validada antes de integrar esta fuente. Se muestran departamento, título, fecha/hora, estado y detalle; se omite el bloque sin registros.
- Mi espacio: Mi Célula cuando existe acceso explícito al portal, integrantes/historial/próxima reunión existente de sus células, Mi trabajo de Oficina y hasta seis departamentos consultables. Tener una responsabilidad eclesiástica no concede acceso. No se generan reuniones al abrir Inicio.
- Accesos rápidos: selección de rutas reales recibidas de la proyección autorizada del servidor y acciones existentes de Oficina, con hasta ocho botones y sin duplicar el mismo destino base. El resto de herramientas sigue en la navegación normal.

Se reutilizan autorización, resolución de liderazgo vigente, políticas departamentales de 1.2, Dashboard de Oficina, eventos de dominio, skeletons, protección del layout, componentes y tokens HALO. No hay dependencias, servicios, variables de entorno o migraciones nuevas para Inicio.

## Rendimiento, errores y estabilidad

Una solicitud inicial devuelve fuentes independientes mediante resultados parciales. Personas/Células usan una consulta agregada; Oficina conserva su consulta consolidada; departamentos usan una consulta con agregaciones y listas limitadas. Mi Célula reutiliza la autorización vigente del portal y consulta sus resúmenes por conjunto, sin llamadas por cada ficha. No se descargan datasets completos al navegador ni se consulta geografía. El motor MapLibre no se carga en Inicio.

Se conservan cero, vacío y error como estados distintos. Una fuente fallida no elimina las demás y permite reintentar solo esa fuente. Una falla de red, JSON inválido, respuesta HTML 503 o demora superior a 20 segundos deja un mensaje y un reintento explícito. La navegación permanece disponible. No hay reintentos infinitos. Las cargas se cancelan al salir; respuestas de otra sesión se descartan. Al actualizar no se recrea el shell ni el contenedor principal.

Los fallos de fuente registran referencia de solicitud, fuente y código en el logger permitido del backend, sin SQL ni datos privados. La respuesta comunica una referencia para diagnóstico y un mensaje seguro.

## Investigación de 503/HTTP/2

Comprobación pública en lectura: página principal, `/health/ready` y `/src/app.js` respondieron **200**. Las consultas de registros de Render del 26/10/2026 no devolvieron errores de aplicación ni entradas HTTP 500/502/503. Esto no descarta fallos intermitentes anteriores, del transporte o ausentes en los registros disponibles. No se atribuye el incidente a Render, MapLibre o Geoapify sin evidencia. No se modificó infraestructura ni se hizo un despliegue.

La recuperación local ante un 503 HTML y ante una conexión fallida se validó separadamente de las consultas reales. Si reaparece el HTTP/2, faltan hora exacta, URL/recurso fallido, mensaje de red y referencia de solicitud para correlacionarlo.

## Verificación

Suite completa: **240/240**, sin fallos, omitidas ni canceladas. Pruebas dirigidas: **19/19**. Cinco recorridos de navegador aprobados: Inicio 2.0, Mi Célula, estabilidad de scroll, HALO transversal (17 vistas) y Departamentos. Comprobación de sintaxis, diferencias y búsqueda heurística de secretos sin incidencias.

Resultados finales registrados en `test-results/home2-full.log`, `home2-directed.log` y `home2-final-*.log`. Las pruebas usan bases temporales y cuentas aisladas, no modifican datos de la demo pública.

Pruebas específicas de servidor: autenticación, filtros rechazados, mínimo acceso, ceros reales, administrador, oficinista, alcance personal, departamentos exactos, revocación, eventos sin notas, errores parciales, número constante de consultas, liderazgo y privilegios SQL mínimos.

Navegador: cinco perfiles, saludo y ausencia de nombre, métricas reales, pendientes, eventos, actividades y detalle, navegación/Atrás, actualización estable, revocación, fuente parcial/reintento, respuesta incompleta, red fallida, HTML 503, carga, menú/teclado y seis anchos (320, 360, 390, 430, 768, 1440) en claro/oscuro/sistema. Capturas de escritorio y móvil en `test-results/home2/`.

Capturas verificadas: `light-1440.png`, `dark-1440.png`, `light-390.png` y `dark-390.png`. Se usan cuentas y registros reales de una base temporal de pruebas; las cifras no representan datos de producción. La navegación por teclado fue comprobada; no se ejecutó una sesión manual con lector de pantalla.

Archivos principales de esta fase: `server/home/service.mjs`, integración en `server/http.mjs`, `src/home/controller.js`, shell de Inicio en `src/components.js`, ciclo de navegación en `src/app.js` y estilos puntuales en `src/office/styles.css`. Se agregaron pruebas de Inicio y actualizaron contratos y selectores históricos afectados; el punto de entrada de la prueba del Inicio de HALO 4 reutiliza el recorrido actual para evitar duplicación.

## Límites y preparación para publicación

La actividad reciente se limita a ocho movimientos, próximas actividades a seis, departamentos personales a seis y células personales a seis. Las cantidades agregadas autorizadas no se calculan a partir de esas vistas previas limitadas. Las actividades próximas conservan el criterio de fecha/hora futura y estados Programada/En curso, sin redefinir vencimientos ni tareas de negocio.

No hay nuevo sistema de tareas, calendario institucional, notificaciones o estadísticas inventadas. El usuario con acceso mínimo recibe bienvenida y actualización, sin bloques vacíos de relleno. La publicación debe incluir las migraciones 020/021 de Organización 1.1/1.2 y sus privilegios antes de usar este Inicio. No se inicia otra fase ni se publica sin autorización.
