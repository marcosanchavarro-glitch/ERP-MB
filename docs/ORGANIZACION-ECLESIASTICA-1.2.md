# Organización Eclesiástica 1.2 — departamentos operativos

Implementación local, sin despliegue. Depende de Organización 1.1, verificada en el repositorio y migración 020. La versión pública permanece en `b2b2317`; 1.1 y 1.2 requieren una publicación posterior autorizada.

## Implementación

Se reutilizan `organizational_units` y `organizational_assignments`: no existe una segunda membresía ministerial. Los espacios departamentales muestran equipo vigente, responsables, métricas reales, próximas actividades y actividad anterior. El equipo permite incorporar, cambiar responsabilidad y finalizar participaciones conservando el historial de 1.1.

La migración 021 agrega actividades, participantes previstos y eventos inmutables. No genera actividades iniciales ni registra asistencia. Las actividades contienen título, descripción, fecha/hora, lugar, responsable, estado y notas. Las transiciones son Programada → En curso → Finalizada, o cancelación desde Programada/En curso con motivo. No se inicia una actividad futura. Se utiliza la fecha/hora de la instalación.

Las operaciones usan transacciones, versiones, bloqueos, claves foráneas, idempotencia y auditoría atómica. El runtime carece de eliminación de actividades y modificación/eliminación de eventos. Cambiar el equipo no elimina participantes previstos históricos ni sustituye automáticamente al responsable de una actividad guardada.

## Accesos y Ficha 360°

Administración permite asignar Consultar/Gestionar a todos los departamentos o a un departamento real mediante búsqueda. El alcance es exacto, sin herencia implícita a subáreas. Las participaciones y cargos eclesiásticos no conceden permisos. Los perfiles técnicos institucionales conservan su política existente de incorporación de permisos funcionales.

La consulta devuelve nombres y funciones del equipo y datos básicos de actividades; no entrega notas internas ni motivos de cancelación. La gestión habilita equipo, historial y actividades dentro del departamento. Incorporar personas requiere además autorización de consulta de esas personas; la vía institucional conserva su requisito de edición. Las ediciones institucionales con alcance personal parcial preservan vínculos no visibles sin revelar sus identificadores.

Ficha 360° muestra actividades únicamente con autorización combinada sobre Persona y departamento. Son participaciones previstas, no asistencias. Se reutilizan formularios protegidos, skeletons, navegación y sistema visual existentes. Los filtros se conservan por usuario/sesión sin cachear registros; una revocación detectada borra datos y acciones obsoletos.

## Verificación y límites

Suite completa: **234/234**, sin fallos. Pruebas específicas: **9/9**. Navegador Edge: Departamentos, Organización, Administración, UX/UI, Personas y estabilidad de scroll aprobados. Se verificaron CRUD, estados, cancelación, participantes únicos, Ficha 360°, asignación administrativa efectiva, consulta/gestión, revocación, seis anchos en claro/oscuro y navegación Atrás conservando filtros.

Capturas: `test-results/departments/overview-1440.png`, `light-390.png`, `dark-390.png`, `team-form-390.png`. Evidencia: `departments-directed-final.log`, `departments-full.log`, `departments-navigation-final.log`.

Listas de 20 registros, hasta 2000 departamentos activos, búsquedas de 30 candidatos, hasta 500 participantes previstos, períodos de hasta 366 días y vistas previas de cinco actividades. Se eligió calendario cronológico, sin nueva agenda institucional. No incorpora notificaciones, turnos, asistencia ni rankings. Sin dependencias, servicios pagos o variables nuevas. Migración aplicada solamente al entorno local. Lista para revisión; publicación pendiente de autorización.
