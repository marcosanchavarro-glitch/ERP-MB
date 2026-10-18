# Dashboard de Oficina — 1.8A

`GET /api/office/dashboard` devuelve pendientes accionables, actividad reciente y acciones rápidas según el acceso efectivo de la sesión. No admite filtros de alcance enviados por el cliente.

## Fuentes reutilizadas

- Asistencia: reuniones existentes programadas o abiertas cuya fecha y hora ya llegaron; células distintas en la semana actual y en semanas anteriores. No genera reuniones al consultar. El enlace histórico abre la semana pendiente más antigua.
- Seguimiento: casos abiertos o en seguimiento y su prioridad URGENT ya registrada; no recalcula reglas.
- Nuevos: estados derivados de `newcomer_progress`, compartiendo la expresión SQL con el listado existente.
- Cumpleaños: Personas activas, calendario existente, hoy y los próximos seis días, incluido el tratamiento vigente del 29 de febrero.
- Calidad: campos de completitud y coincidencias existentes de Personas; células activas sin líder vigente. Los enlaces aplican los filtros correspondientes.
- Actividad: eventos de Personas, Células, Reuniones, Seguimiento y Nuevos. Solo etiquetas generales, fecha y acceso al registro; no incluye notas, peticiones, observaciones ni datos del actor.

## Permisos y rendimiento

El servidor incluye únicamente fuentes autorizadas. Cumpleaños y calidad intersectan el permiso específico con el permiso de consulta y su alcance. El historial de Personas exige además `personas.historial`. Los accesos de creación se muestran únicamente cuando pueden ejecutarse y consultarse; Recepción conserva su permiso propio.

Una consulta SQL agrupa los contadores en PostgreSQL. La actividad se limita a ocho eventos por fuente y ocho en total. No se descargan datasets para calcular cifras. Actualizar vuelve a verificar los permisos; los errores eliminan el contenido anterior de la pantalla.

El contrato de tarjetas (`id`, `title`, `note`, `items`) admite futuros resúmenes como Citas sin modificar el renderizador. No se implementa Citas ni se agregan reglas, permisos o migraciones.

## Validación

`tests/dashboard.test.mjs` cubre agregaciones, scopes, exclusión de fuentes, actividad sin contenido sensible, fechas, enlaces filtrados y volumen. `tests/dashboard-browser.mjs` cubre navegación, permisos revocados, errores y responsive a 1440, 768, 390 y 320 px en claro, oscuro y sistema.
