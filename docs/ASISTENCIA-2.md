# Asistencia 2.0

Asistencia abre la Vista mensual para usuarios con acceso efectivo al control mensual de Oficina. Se mantienen Control de células y Reuniones con la carga semanal y sus operaciones existentes. Los usuarios con acceso únicamente a asistencia conservan el control semanal; no reciben permisos de Oficina nuevos.

La matriz de escritorio toma sus fechas de las reuniones aplicables, sin columnas fijas ni un día común para todas las células. La lista móvil muestra cada Persona con sus fechas y estados, sin comprimir la tabla. Los filtros secundarios son desplegables y muestran su cantidad activa. Mes, filtros y búsqueda permanecen en la ruta; abrir/cerrar la ficha conserva la pantalla y el scroll. Los gráficos existentes quedan disponibles bajo «Ver análisis del mes».

Se reutiliza `GET /api/office-work/monthly`, ampliado con fechas, resumen de reuniones, racha del mes y último contacto efectivo de ese mes. Admite filtro de estado y búsqueda por nombre, apellido, teléfono o célula visible. La racha utiliza `calculate` del dominio de Seguimiento; la participación usa la vista compartida y las membresías vigentes en cada fecha. Se paginan 50 Personas y los totales se agregan en SQL, sin consultas por fila ni cargar fichas completas en la matriz.

La Ficha 360 existente recibe un resumen del mes y abre el mismo formulario de Contactos de Oficina. Su origen se propone como INASISTENCIA únicamente si el contexto tiene ausencias; en caso contrario propone CONTACTO_MENSUAL. Claims, guardado, correcciones e historial usan los endpoints existentes. Al guardar se notifica a la vista mensual, que actualiza filas y resumen sin remontar la aplicación. «Guardar y siguiente» sigue usando la cola original en Mi trabajo; en la ficha manual la acción se denomina «Guardar contacto».

Pendiente, próxima y cancelada siguen excluidas de las ausencias. NO_CONTESTO registra un intento y conserva el reintento existente, sin sumar contacto efectivo ni cobertura. Las observaciones privadas se consultan únicamente en las secciones autorizadas de la ficha. PersonId, cellId, scopes de Personas, Asistencia, Células y Seguimiento se validan en backend; el portal Mi Célula no obtiene acceso general.

No se crean tablas, migraciones, estados, permisos, colas ni motores adicionales. Se reutilizan Skeleton y los tokens globales. Las pruebas dirigidas cubren fechas, membresías temporales, correcciones, búsquedas, scopes, contacto/intento, retorno a la matriz, seis tamaños, tres temas y estados de carga/error.
