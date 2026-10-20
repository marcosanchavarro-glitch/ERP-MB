# Oficina 2.0

La entrada Oficina y «Mi trabajo» abren el centro personal. El Dashboard anterior conserva sus pendientes generales y añade un acceso al trabajo personal. No se modifican credenciales.

## Puesta en marcha

Un administrador con `oficina.configurar` abre **Mi trabajo → Configurar equipo**, activa cada cuenta, selecciona explícitamente Hombres, Mujeres o ambos, y guarda su meta, intervalo de reintento y duración de reserva. La cuenta debe tener sus permisos efectivos y puede vincularse con una Persona desde Administración → Usuarios para mostrar su nombre real. No se crean perfiles de personal ni se infiere sexo automáticamente.

La meta predeterminada de 6 corresponde a contactos efectivos. Diez intentos con tres contactos establecidos muestran 3/6. Los resultados No contestó, Volver a llamar, Número incorrecto y Otro quedan registrados, pero no suman a la meta ni a la cobertura.

## Trabajo operativo

La cola prioriza urgencia y ausencias existentes, casos activos, reintentos disponibles y cobertura mensual. Distribuye Personas entre los perfiles elegibles mediante un reparto determinista que cambia diariamente. La reserva exclusiva vence automáticamente; no constituye una asignación permanente. Si el grupo propio se agota, se ofrece trabajo elegible de otro grupo.

No contestó conserva a la Persona pendiente, fija el próximo momento elegible y permite guardar y seguir inmediatamente. Un callback admite fecha futura opcional; sin fecha utiliza el intervalo configurado. No requiere cron. La selección manual permite atender una Persona ya cubierta; siempre valida permisos, configuración de sexo y reserva. Número incorrecto añade una incidencia a Calidad sin cambiar el teléfono.

## Cobertura y asistencia

Una Persona activa queda cubierta en un mes calendario cuando tiene al menos un contacto establecido en ese mes, usando la zona horaria central de la instalación. Los intentos se cuentan por registro; la cobertura cuenta Personas distintas. Corregir un resultado recalcula ambos desde la fuente canónica y conserva la revisión anterior.

Control mensual muestra Personas paginadas, su asistencia por fecha y los contactos autorizados. Reutiliza snapshots de reuniones abiertas y membresías temporales para reuniones aún no abiertas. Pendiente, próxima y cancelada no significan ausencia y no entran al denominador presente/ausente. Las gráficas agregan datos reales en SQL. La asistencia por célula usa la célula de la reunión; la cobertura por célula usa la pertenencia actual, identificada por separado.

Los enlaces de Persona abren la Ficha 360 completa existente según permisos. Su pestaña Contactos de Oficina permite consultar, registrar y corregir sin abandonar el control mensual. Los contactos pueden vincularse a un caso de seguimiento existente; no se duplican notas entre modelos. Las intervenciones anteriores se muestran como historia sin clasificación efectiva y no se convierten automáticamente.

## Accesos y persistencia

Permisos globales: `oficina.trabajar`, `oficina.contactos.ver`, `oficina.contactos.registrar`, `oficina.contactos.corregir`, `oficina.panorama`, `oficina.configurar`. Además se exige el alcance de Personas y se respetan los alcances independientes de Asistencia, Células y Seguimiento. La API vuelve a validar cada solicitud. Un oficinista corrige sus registros; Panorama permite corregir los ajenos si también se concede el permiso de corrección.

La migración 013 añade configuración, reservas, contactos, revisiones inmutables y una vista compartida de participación temporal. No altera asistencia histórica ni elimina datos. Las correcciones conservan motivo y versión. La auditoría técnica registra resultados y referencias; no copia observaciones privadas. Los contactos completos y sus revisiones solo se envían al historial autorizado de la Persona.

No se incorpora Tareas, IA, integración telefónica ni otra fase. El despliegue mantiene los servicios gratuitos existentes.
