# Citas / Agenda — 1.8B

La agenda registra citas coordinadas por Oficina para una Persona de Matriz, un Nuevo o un externo. Los vínculos se mantienen separados; un externo solo necesita nombre, con contacto opcional. La fecha y hora corresponden a la zona de la instalación. La duración, entre 5 y 480 minutos, permite detectar superposiciones sin inferir disponibilidad.

Los responsables se configuran y deshabilitan desde Citas > Responsables. Apóstol Diego y Pastora Mariela son registros iniciales editables; ninguna regla depende de sus nombres. El modelo admite vincular un usuario existente mediante `user_id`, sin requerir que todo responsable tenga cuenta.

La lista paginada admite Hoy, Próximas, Pasadas, Canceladas, Todas y Requieren seguimiento, además de fecha, responsable, estado y búsqueda. Editar permite reprogramar o marcar AGENDADA, REALIZADA, NO_ASISTIO y CANCELADA. La cancelación conserva el registro. La versión evita sobrescrituras y el bloqueo del responsable serializa reservas concurrentes. Una superposición devuelve `SCHEDULE_OVERLAP`; solo un gestor puede confirmarla explícitamente.

Permisos globales independientes: `citas.ver` (horarios), `citas.detalles` (solicitante y contenido normal), `citas.gestionar` (operaciones), `citas.privadas` (contenido privado, junto con detalles) y `citas.responsables` (configuración). Administrador General y Apóstol reciben estos permisos por el mecanismo de perfiles existente. Oficina recibe ver/detalles/gestionar; no recibe privadas ni responsables automáticamente. Los permisos explícitos pueden ajustarse desde Administración.

Sin acceso a detalles, el servidor devuelve solamente el horario, responsable, estado, privacidad, versión e historial operacional. Oculta identidad, contactos, motivo y seguimiento; también los excluye de búsquedas. La gestión restringida solo permite cambiar horario, responsable o estado, conservando contenido y privacidad. Crear o reclasificar una cita privada requiere permiso privado. El acceso a una Persona no habilita citas privadas.

Una cita realizada puede conservar seguimiento pendiente, responsable y fecha opcionales y nota breve. Se resuelve desmarcando seguimiento; no crea casos de inasistencias ni un módulo pastoral. La nota hereda la privacidad de la cita.

Dashboard muestra conteos operacionales y enlaces; el seguimiento se cuenta únicamente cuando sus detalles están autorizados. No incluye motivos, identidades ni notas. La Ficha 360° ofrece acceso a citas autorizadas cuando existe permiso de agenda; la consulta vinculada exige además acceso a la Persona.

Los eventos y la auditoría existente registran creación, modificación, reprogramación (fecha/hora anterior y nueva), cancelación, estados, privacidad y responsable. No copian motivos, contactos, nombres de solicitantes o notas. El historial es inmutable; las escrituras y la auditoría comparten transacción.

Pruebas: `tests/appointments.test.mjs` y `tests/appointments-browser.mjs`. Incluyen privacidad por API, revocación, CSRF/IDOR, concurrencia, auditoría, vínculos, agenda y Dashboard, además de claro/oscuro/sistema y 1440/768/390/320 px.
