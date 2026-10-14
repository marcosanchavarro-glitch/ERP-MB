# Subfase 1.4 — Portal del Líder

Entrega local del 13 de octubre de 2026. Entrada: `/#/mi-celula`, con la autenticación existente. No hay registro público ni creación automática de usuarios.

## Informe de entrega

1. **Estado previo.** Existían Personas, Células, autenticación y permisos, Ficha 360°, Matriz y asistencia 1.3 con generación semanal, snapshots y control de versiones. Antes de modificar se ejecutó la suite completa: 56/56 pruebas Node y 6/6 suites de navegador aprobadas.
2. **Arquitectura.** `server/leader/` separa HTTP, servicio, consultas y proyecciones. `src/leader/` contiene API, controlador y vistas. La navegación contextual usa los iconos configurables centrales. La pantalla sencilla incluye reunión actual, siguiente reunión, integrantes, cumpleaños e historial, sin menú administrativo para cuentas exclusivamente líderes.
3. **Usuario → Persona.** Se reutiliza `users.person_id`, relación opcional y única existente. La habilitación explícita requiere una cuenta activa vinculada y el permiso `lider.portal`. La migración 006 crea permiso y rol, pero no los asigna a ninguna cuenta. Ser Persona o Líder no crea credenciales.
4. **Alcance celular.** Se deriva de la relación actual `LEADER`, sin fecha de finalización, con inicio no futuro y célula activa. El servidor vuelve a consultar identidad, autorización y membresía en cada operación. No almacena este alcance en la sesión como autoridad permanente.
5. **Dos líderes.** Ambos acceden a los mismos registros persistidos. Comparten generación idempotente, snapshots y versiones. Una edición concurrente obsoleta se rechaza; nunca sobrescribe silenciosamente a la otra. Las pantallas visibles comprueban cambios cada tres segundos y al recuperar foco; no es una conexión push.
6. **Pérdida de liderazgo.** La siguiente petición pierde el alcance, incluso con la misma sesión. El portal limpia la vista al detectar la denegación. Los permisos explícitos ajenos al portal se conservan. El historial de una antigua membresía no concede acceso.
7. **Transferencia.** El alcance se recalcula para la célula vigente y se deniega la anterior. Los bloqueos y la segunda comprobación tras esperar el bloqueo impiden usar una autorización antigua para una escritura tardía.
8. **Asistentes.** No reciben acceso automático. Una cuenta habilitada sin liderazgo vigente ve “No tenés una célula asignada actualmente.” La eventual delegación a asistentes requiere una política futura explícita.
9. **Ficha restringida.** Identificador, nombre, apellido, teléfono, nacimiento y rol, más hasta diez registros recientes de asistencia de esa célula. No contiene documento, email, domicilio, notas administrativas, auditoría ni historia de otras células. Los cumpleaños se calculan desde nacimiento, sin duplicar datos.
10. **Datos protegidos.** El servidor proyecta campos permitidos antes de responder; no descarga la ficha completa para ocultarla con CSS. Los antiguos integrantes pueden aparecer por nombre y marca en snapshots históricos, pero no permiten abrir la ficha actual ni exponen teléfono o nacimiento. Las observaciones operativas de asistencia son distintas de las notas administrativas de Persona.
11. **Asistencia 1.3.** Se reutilizan generación y acciones del servicio existente dentro de la transacción del portal. Un adaptador privado permite únicamente operar sobre la célula ya validada; no agrega permisos generales a la cuenta ni a su sesión. La carga incluye búsqueda, marcas individuales, todos presentes, contadores, observaciones y una confirmación con resumen antes de guardar. CARGADA admite correcciones según las reglas existentes.
12. **Reuniones cerradas.** Son de solo lectura. El líder debe recurrir a Oficina para reabrir; el portal no evita el cierre administrativo. Las comprobaciones de versión conservan el borrador ante conflictos y exigen recargar antes de continuar.
13. **Cancelación.** Cancelar, cerrar y reabrir quedan reservados a Oficina. Una cuenta con permisos administrativos explícitos puede cambiar de contexto para ejercerlos. El portal admite únicamente abrir y guardar; una llamada manual a otras acciones recibe denegación.
14. **Autorización e IDOR.** Se comprueban célula, reunión y Persona en backend. UUID y rutas manipulados no amplían acceso. Las API generales de Personas, Células y Matriz siguen denegadas a una cuenta exclusivamente líder. Se mantienen CSRF, validación, SQL parametrizado, sesiones y errores seguros. Otros permisos explícitos se acumulan sin ser reemplazados.
15. **Auditoría.** Las acciones reutilizadas registran al Usuario real de la sesión, con la misma atomicidad de 1.3. Un fallo de auditoría revierte el cambio funcional. La habilitación administrativa registra `USER_LEADER_PORTAL`; su actor CLI es `system:leader-account-cli`, coherente con la administración existente.
16. **Responsive.** Se verificaron 320, 390, 820 y 1440 px: botones táctiles, lista vertical, ficha, búsqueda y confirmación sin desplazamiento horizontal. Capturas locales en `test-results/leader-*.png`. No se realizó el rediseño general.
17. **Pruebas nuevas.** Trece pruebas Node cubren autorización explícita, cuentas sin vínculo, asistentes, dos líderes, concurrencia, IDOR, proyección de datos, transferencias, exlíderes, permisos acumulados, cierre, cumpleaños, antiguos integrantes, bloqueo, reversión, paginación e iconos. Una suite de navegador cubre entrada directa, flujo móvil, ficha, cumpleaños, confirmación, red, sesión vencida, conflictos, actualización del colíder, historial y revocación.
18. **Suite completa.** Resultado final: **69/69 pruebas Node y 7/7 suites de navegador aprobadas**. Se conservaron todos los casos anteriores; únicamente se ajustaron expectativas de cantidad de migraciones. Evidencia local: `test-results/14-final-node.log` y `test-results/14-final-browser.log`.
19. **Regresiones.** No se detectaron regresiones en la suite completa de fases anteriores. La integración conserva rutas, datos y permisos de Oficina. No se modificaron contraseñas ni se generaron cuentas reales para demostrar el portal.
20. **Deudas técnicas.** En la entrega original 1.4 la administración era por CLI. La fase transversal 0.5 incorpora la interfaz de [Usuarios](ADMINISTRACION-USUARIOS.md), conservando ese CLI. La sincronización visual usa consultas periódicas. No hay asistencia offline ni instalación PWA. Borradores en memoria, no persistentes tras cerrar el navegador. Producción mantiene los pendientes de HTTPS, backups ensayados y monitoreo descritos en Operación. No se añadieron dependencias ni variables de entorno.

## Habilitar una cuenta

Aplicar `npm run db:migrate` y reiniciar la aplicación. La migración `006_leader_portal.sql` no modifica Personas, membresías, contraseñas o sesiones existentes y no concede el rol automáticamente al administrador.

Usar el mecanismo administrativo existente con `MIGRATION_DATABASE_URL`. Para vincular y autorizar una cuenta existente:

```text
npm run leader:account -- --user=UUID_USUARIO --person=UUID_PERSONA
```

Para crear explícitamente una cuenta vinculada, proporcionar la contraseña por entrada estándar, mediante el canal seguro utilizado por el operador; nunca como argumento:

```text
npm run leader:account -- --create --username=NOMBRE_USUARIO --person=UUID_PERSONA --password-stdin
```

Para retirar únicamente el rol del portal:

```text
npm run leader:account -- --user=UUID_USUARIO --disable
```

La actualización conserva otros roles y revoca las sesiones cuando cambia la autorización o vinculación. Retirar el rol no elimina la Persona ni su vínculo. El permiso global `lider.portal` habilita el contexto: **no significa acceso global a células**. Siempre se exige liderazgo vigente. Una cuenta habilitada entra directamente a Mi Célula al iniciar sesión; otros accesos explícitos se muestran como navegación adicional.

## Límites y decisiones de calendario

Integrantes: búsqueda y paginación en servidor, 50 por página. Cumpleaños: hoy y próximos 30 días, hasta 50 resultados mostrados con total; el 29 de febrero se recuerda el 28 en años no bisiestos. Las fechas usan Buenos Aires. Historial por ventanas de cuatro semanas, con navegación a anteriores. La preparación inicial conserva el límite de 35 días de 1.3 y no duplica reuniones. Se mantienen los límites de 5000 registros de asistencia y cuerpo de 4 MiB para esa acción. Las consultas no cargan una ficha completa por integrante.

## Confirmaciones de alcance

Las pruebas no detectaron roturas de fases anteriores. El backend sigue siendo autoridad de permisos. El acceso celular del portal proviene exclusivamente del liderazgo vigente de un Usuario autorizado: el exlíder pierde ese alcance y los asistentes no reciben acceso automático. No se exponen fichas completas de Personas. No se desarrollaron alertas por inasistencia ni otros módulos. **No se avanzó a 1.5; requiere autorización nueva.**
