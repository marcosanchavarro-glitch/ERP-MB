# Nuevos e integración — 1.7

Recepción registra en `/recepcion` con `nuevos.registrar`. No recibe consulta de Matriz ni del seguimiento interno. Oficina trabaja en `/oficina/nuevos`; los permisos `ver`, `gestionar`, `cafe` y `consolidar` se administran desde Usuarios. El perfil Recepción solo concede registro.

`newcomers` conserva UUID, datos iniciales, usuario y fechas. Las derivaciones temporales (`newcomer_referrals`) no son membresías. `newcomer_attendance` registra una marca por Nuevo/reunión real. El progreso se consulta desde `newcomer_progress`: solo presentes en reuniones cargadas/cerradas, nunca canceladas, y asistencia a un Café realizado. Invitación y asistencia son distintas.

La recomendación explica sexo y localidad. Las células actuales no tienen un rango etario declarado: se muestra como información pendiente, sin inferir edades a partir del código. El ordenamiento queda aislado en el servicio y admite incorporar un cálculo de distancia futuro. La selección es siempre manual.

Mi Célula muestra datos mínimos de Nuevos con derivación vigente a esa célula. El adaptador vuelve a comprobar cuenta, liderazgo y destino en cada operación. No expone peticiones, notas internas ni contactos. La asistencia de Nuevos tiene un bloque y guardado separado de miembros; el progreso cuenta cuando la reunión queda cargada. Las correcciones usan versión y bloqueo de reunión/Nuevos.

Tres asistencias y un Café dejan al Nuevo listo; nunca crean Persona. Oficina revisa los datos y confirma el alta. Una sola transacción reutiliza Personas y membresías, guarda el vínculo y la auditoría. La repetición devuelve la misma Persona. La ficha recibe una reseña de ingreso sin notas internas; el historial completo permanece en Nuevos. Las correcciones posteriores no deshacen un alta ya confirmada.

Archivo reversible, sin eliminación ordinaria. Historial inmutable. Consultas paginadas y controles backend independientes de la navegación. Se conserva el tema global claro/oscuro/sistema.

La migración 010 agrega tablas, permisos y admite versionar una reunión abierta al guardar el bloque de Nuevos. El seed DEMO es explícito e idempotente, limitado a instalaciones con el marcador de datos ficticios iniciales; no cambia cuentas ni contraseñas.

Validación: `node --env-file=.env --test tests/newcomers.test.mjs` y `node --env-file=.env tests/newcomers-browser.mjs`; requieren PostgreSQL local y, para navegador, Playwright/Edge. Sin importaciones, mensajería externa, mapas ni fase 1.8.
