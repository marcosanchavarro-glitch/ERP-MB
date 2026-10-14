# Ajuste funcional 1.2 — Personas, integrantes y preparación CSV

## Uso diario

**Personas / Matriz → Alta rápida** permite crear la misma Persona central con nombre, apellido, sexo y, si están disponibles, celular/documento. Solo nombre y apellido son obligatorios; se conservan UUID, estado ACTIVA, completitud, búsquedas, Ficha 360°, historial y auditoría. **Nueva persona** conserva el alta completa, y **Editar persona** permite completar cualquier ficha después.

El componente de alta rápida se reutiliza dentro de Células. Si la búsqueda no encuentra a la persona, `+ Crear «nombre buscado»` abre el formulario en el mismo lugar. Se propone una separación inicial de nombre/apellido que el operador debe revisar; no se guarda hasta confirmar. Al crear, la Persona queda seleccionada para el lote; no es temporal ni se asigna automáticamente. Si después se cancela la asignación o falla el lote, la Persona ya creada permanece en la Matriz.

**Célula → Agregar integrantes** abre un selector con búsqueda de servidor por nombre, documento o celular (20 resultados por página). Conserva selección entre búsquedas/páginas; cada selección puede quitarse desde su casilla o desde el resumen. El contador y la acción final permanecen visibles. Se permite un máximo de 500 Personas por lote, con jerarquía Miembro para todas. Líder/Asistente se asignan con Cambiar jerarquía, conservando los límites y el historial anteriores.

Cada resultado distingue Disponible, Ya en esta célula o Actualmente en otra célula. Quienes ya pertenecen a una célula no se pueden seleccionar para el lote. Cuando hay permisos en ambos extremos se ofrece **Transferir a esta célula**, con confirmación explícita y fecha. Usa la operación transaccional anterior desde el mismo contexto; las demás selecciones permanecen.

Los códigos y detalles de una célula fuera del alcance no se exponen: se muestra que la pertenencia está restringida y no aparece Transferir. Tampoco se amplía el permiso de Persona por pertenecer a una célula.

## Sexo de Persona

El contrato y la restricción PostgreSQL usan `HOMBRE` / `MUJER`, distintos de F/M en Célula. Los formularios solo ofrecen Hombre y Mujer; el placeholder vacío no es una tercera categoría. NULL sigue permitido para datos desconocidos.

`004_office_workflow.sql` convierte MASCULINO → HOMBRE y FEMENINO → MUJER. Los antiguos OTRO/NO_INFORMA pasan a NULL; **cada valor anterior queda en una nueva entrada de auditoría**, sin alterar auditorías históricas. Se incrementa versión de las fichas afectadas para evitar guardar formularios obsoletos. El importador técnico antiguo de SQLite también adapta su representación; SQLite sigue fuera de la ejecución de la aplicación.

Una diferencia entre sexo de Persona y F/M de Célula genera advertencia en el selector y en el resultado del lote, pero no bloquea ni cambia datos.

## Batch y seguridad

- `GET /api/cells/:id/candidates`: búsqueda paginada y disponibilidad, con alcance de Personas y célula; no descarga toda la Matriz.
- `POST /api/cells/:id/members/batch`: `{personIds, date, version, reason?}`. No acepta roles arbitrarios ni campos internos.

**Todo o nada:** duplicados, permisos insuficientes, Personas inexistentes, pertenencias previas, fechas incompatibles o versión obsoleta rechazan el lote completo. Un conflicto devuelve los UUID autorizados que requieren revisión, sin información de células restringidas. La interfaz conserva la selección restante y permite volver a confirmar después de revisar; nunca reintenta una escritura automáticamente.

La operación bloquea célula y Personas, revalida dentro de la transacción, crea una operación BATCH_ASSIGN, membresías MEMBER, eventos funcionales por Persona y una auditoría del lote con antes/después. Actualiza la versión una sola vez. Los índices de pertenencia única y los triggers de cupos siguen activos. Se mantienen CSRF, sesiones, permisos, rate limiting, SQL parametrizado, validación y escape de HTML.

Los servicios de Persona, resolución de Célula y batch admiten un cliente transaccional interno para composición futura. Ese parámetro **no es parte de la API HTTP**. Su contrato exige que el llamador abra la transacción y revierta todo ante cualquier error.

## Preparación de CSV implementada

Todavía no hay infraestructura CSV ni asistente de importación en el proyecto; **no se agregó carga de archivos, ejecución de un CSV ni datos históricos**.

Se dejaron preparados:

1. `parseCellCode`: normaliza `j1f`, `J1F`, `J1 F` a componentes y `J1 F`; rechaza códigos imposibles o ambiguos. Grupo A–Z, generación 1–9999, F/M; no acepta ceros iniciales.
2. `normalizePersonSex`: acepta equivalencias claras (Hombre/Masculino, Mujer/Femenino, etc.), conserva vacío y devuelve error ante ambigüedad. `M` aislada requiere revisión, porque podría significar Masculino o Mujer.
3. `personImportSignals`: claves normalizadas de documento, celular y nombre/apellido para la revisión de duplicados. No fusiona Personas ni decide identidad automáticamente.
4. `previewImportCells`: deduplica códigos, consulta células activas en conjunto y devuelve existentes/a crear/errores, sin escribir en la base.
5. `resolveImportCell`: dentro de una transacción del llamador, reutiliza solo la célula activa o crea una nueva con UUID y auditoría. Una célula cerrada no se reutiliza. La unicidad activa protege también carreras concurrentes; un conflicto requiere revalidar/reintentar la transacción completa.
6. `assignBatch` y `people.save` pueden participar de esa misma transacción. Hay una prueba que fuerza un error después de crear Persona + Célula + membresía y comprueba que nada queda guardado.

## Células incompletas y fechas

La migración hace opcionales `openedDate` y `lastEffectiveDate`; los eventos de creación también pueden tener fecha efectiva desconocida, manteniendo siempre su fecha real de registro. No se sustituyen fechas faltantes por el día de importación. Código y estado bastan para crear una célula, sin inventar dirección, reunión ni apertura.

`cellCompletion` calcula Pendiente de completar si falta apertura, día, horario, dirección o localidad; aparece en Matriz y ficha. Es un indicador administrativo, no un impedimento para asignar integrantes.

Una apertura desconocida puede completarse posteriormente, siempre que no sea posterior a la primera pertenencia. Una apertura ya conocida conserva la regla anterior de no reescritura. La fecha de cada movimiento celular sigue siendo obligatoria, no futura y coherente con el último movimiento.

El futuro importador deberá solicitar una política/fecha efectiva explícita para pertenencias sin fecha histórica. **No debe inferir fecha de apertura o de ingreso desde el código ni presentarlas como conocidas.** Esta decisión también aplica a Asistencia futura.

## Trabajo reservado a la fase de importación

El asistente completo deberá implementar archivo → lectura → normalización → validación → previsualización → confirmación → importación. Antes de escribir tendrá que mostrar cifras reales, revisar documento coincidente y señales de celular/nombre, permitir resolver ambigüedades y revalidar permisos, versiones y conflictos al confirmar.

También deberá persistir el lote, actor, fechas, origen seguro/huella de archivo, resultados y errores; definir límites de tamaño/formato, autorización propia e idempotencia. No debe almacenar el archivo o datos personales en logs ni fusionar identidades ambiguas. Estas capacidades no están simuladas en esta entrega.

## Actualización y pruebas

Detener la aplicación, mantener PostgreSQL activo y ejecutar `npm run db:migrate`; después `npm run dev`. No se requieren dependencias nuevas, variables nuevas, credenciales nuevas ni cambios de grants. La cuenta existente sigue funcionando.

Se conservan todos los casos anteriores, adaptando únicamente expectativas de sexo, número de migraciones y la entrada a Agregar integrantes (batch + promoción individual). Las nuevas pruebas verifican alta rápida real/contextual, Hombre/Mujer/NULL, normalización histórica auditada, lote único/duplicados/conflictos, rollback, concurrencia, permisos/IDOR/CSRF, códigos históricos, células incompletas y composición transaccional futura.

La prueba de navegador verifica selección/deselección entre búsquedas, disponibilidad, transferencia confirmada sin navegar, alta contextual, advertencias, una sola petición batch y responsive 1440/820/390/320. También comprueba recuperación del borrador de alta rápida tras revocar la sesión del mismo usuario.

Resultado final: **43/43 pruebas Node y 5/5 suites de navegador aprobadas**. El escáner de secretos también pasó. Los logs y capturas están en `test-results/`, fuera de Git.

No se cambió la identidad visual, no se quitaron los controles de seguridad y **no se desarrolló Asistencia ni el importador CSV definitivo**.
