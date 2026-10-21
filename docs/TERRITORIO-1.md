# Territorio 1.0

La ubicación principal es el lugar habitual de reunión de una célula. No se copia
el domicilio de Personas o del líder. No determina dónde ocurrió cada reunión:
una futura ubicación excepcional debe pertenecer a la reunión, sin reescribir
esta referencia ni sus datos históricos.

Se reutilizan `cells.address`, `locality`, `municipality`, `province`, `reference`,
`latitude`, `longitude` y la clasificación explícita `gender` (`F`/`M`, restringida
por PostgreSQL). No se deduce la clasificación a partir del código ni se agregan
restricciones de membresía.

La migración SQL aditiva `014_cell_territory.sql` incorpora país, estado de
verificación, fecha de actualización geográfica, edades recomendadas mínima y
máxima, indicador sin restricción etaria y radio opcional. HALO utiliza `pg` y
migraciones SQL versionadas; no utiliza Prisma. No se introduce otro ORM.

Todos los campos nuevos son opcionales y carecen de valores ficticios. Las
coordenadas existentes sin estado se consideran pendientes de verificar. La
restricción de pares/rangos se agrega `NOT VALID` para no modificar ni impedir
la migración por coordenadas históricas antes no validadas; se exige en nuevas
escrituras. Si existiera un par histórico inválido, deberá revisarse manualmente
antes de actualizar esa célula. No se corrige automáticamente.

Coordenadas finitas, ambas presentes o ambas ausentes; latitud ±90, longitud
±180. Verificar requiere coordenadas. Un cambio del lugar previamente verificado
restablece PENDING: guardar el cambio y verificar manualmente en una segunda
edición. Sin coordenadas no hay estado de verificación. `locationUpdatedAt`
solo cambia con ubicación/verificación, no por ediciones de notas o membresías.
Los clientes anteriores que omiten campos territoriales conservan esos datos.

Las edades recomendadas son enteros no negativos, opcionales, mínima ≤ máxima;
el indicador sin restricción requiere dejar ambos límites vacíos. No se derivan
de miembros ni se usan para bloquear asignaciones. Radio: número finito >0 y
≤100000 metros (100 km), límite operativo de validación. Es una referencia
geográfica, no evidencia de cobertura pastoral.

`ageStatistics` en la consulta administrativa calcula mínimo, máximo y promedio
(un decimal), conocidos y desconocidos, a la fecha local de consulta. Población:
rol MEMBER con pertenencia vigente (`startDate <= fecha`, `endDate` ausente o
posterior). Excluye líderes y asistentes, sin introducir otro criterio de estado
de Persona. Un cumpleaños del 29/2 se considera el 28/2 en años no bisiestos,
igual que Cumpleaños. No guarda edades ni descarga fichas para calcularlas;
realiza una agregación SQL adicional solo en la ficha, no en cada fila de matriz.

Se exige `celulas.ver` para consultar, `celulas.editar` para editar y
`celulas.crear` para crear, con los alcances existentes y CSRF. La composición
etaria completa se omite si falta acceso a alguna persona de esa población;
no se muestra una estadística parcial como total. Mi Célula conserva su DTO
explícito, sin dirección ni coordenadas nuevas. No se agregan endpoints públicos,
roles, accesos de HDR o permisos de Territorio.

La auditoría transaccional CELL_CREATE/CELL_UPDATE registra actor, fecha,
entidad y valores anteriores/nuevos de todos los campos modificados. Los logs
técnicos conservan su proyección sin cuerpos ni domicilios.

Pruebas dirigidas: validaciones, persistencia, auditoría, reverificación,
compatibilidad de clientes, cálculo etario/bisiestos, autorización y privacidad.
Navegador: alta/edición territorial, teclado y Light/Dark a 320, 360, 390, 430,
768 y 1440 px, además de regresiones de Células, Asistencia y administración.

No incluye mapa, geocodificación, recomendaciones, búsqueda ni asignación
automática. La verificación manual y la calidad de los datos siguen siendo
responsabilidad administrativa. Las pruebas usan bases temporales, sin cambiar
registros reales para demostraciones.
