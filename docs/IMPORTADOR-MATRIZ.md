# Importador de Matriz — 1.9A

Oficina > Importar / Exportar implementa únicamente Importar. Flujo: archivo, mapeo, normalización, validación y conflictos, previsualización, resolución, confirmación y reporte. No hay exportación, merge, actualización de Personas existentes ni borrado masivo.

## Archivos y normalización

CSV UTF-8 con coma, punto y coma o tabulación, comillas y saltos de línea; XLSX con una sola hoja. Límites: 5 MB, 2000 filas, 40 columnas, 4000 caracteres por celda y 32 MB descomprimidos. El servidor verifica base64, contenido y estructura; limita ZIP y XML antes de cargar el libro. Rechaza macros, enlaces externos y contenido activo. Las fórmulas XLSX no se evalúan: una columna mapeada con fórmula requiere corrección/omisión; las derivadas ignoradas no se persisten. Los lectores son [ExcelJS](https://github.com/exceljs/exceljs) y [yauzl](https://github.com/thejoshwolfe/yauzl); UUID transitivo usa una versión corregida compatible.

Se sugieren las columnas históricas de Notion y se ignoran cumpleaños, fórmulas y placas derivadas. El mapeo puede modificarse. Documento/celular exactamente «0» se convierten en NULL; se reutilizan normalizadores, validación y motor de Calidad existentes. Sexo usa las equivalencias existentes, sin inferencia.

Las fechas españolas se interpretan mediante meses y días explícitos, incluido año bisiesto; también se aceptan ISO y día/mes/año. El parser no utiliza interpretación regional de Date.parse. Fechas inválidas se corrigen u omiten.

Nombre y Apellido original permanece en la previsualización. «Apellido, Nombres» ofrece una separación explícita; otros nombres completos requieren revisión manual. Nunca se inventa un apellido ni se descartan silenciosamente partes. También pueden mapearse Nombres y Apellidos por separado.

## Células, coincidencias y confirmación

Los códigos usan letras Unicode; Ñ1 F es válido. PostgreSQL aplica clasificación ICU explícita para evitar depender del locale del servidor. Se reutilizan Células activas; una nueva se crea incompleta solo después de confirmación. Un código histórico cerrado crea otro UUID, sin reactivar el anterior. «Pastores» requiere ignorar asignación o corregir/mapear a un código válido. Rol predeterminado Miembro; Líder/Asistente se seleccionan explícitamente y respetan límites actuales. La fecha efectiva de membresías se muestra y confirma, sin inventar una fecha histórica.

Se comparan documentos, nombres, teléfonos y combinaciones de nombre/nacimiento contra Matriz y entre filas. Nacimiento aislado nunca identifica una Persona; teléfono compartido solo advierte. Un documento real ya registrado o repetido bloquea esa fila: esta fase no lo sobrescribe. Las coincidencias ambiguas se omiten o se confirman expresamente como Personas nuevas.

El resumen indica cuántas filas bloquean la confirmación. «Ver filas pendientes» las filtra y «Omitir filas pendientes» permite descartar en conjunto las que tengan errores o revisión, conservando las listas. Después se muestra el resumen recalculado y se exige la confirmación final.

La previsualización no escribe tablas de negocio, auditoría ni staging. El archivo vive en memoria de la pantalla y solicitud, sin almacenamiento permanente. Un plan firmado, vinculado al usuario, vence a los 30 minutos. Cambiar mapeo/fecha/decisiones exige analizar nuevamente. El servidor verifica firma, permisos y estado de datos al confirmar.

La confirmación transaccional usa Person, resolveImportCell y movimientos de Células existentes. Si falla cualquier operación, revierte Personas, Células y membresías. ImportBatch conserva metadatos, contadores y resultado; ImportRecords vincula fila, Persona, Célula, si fue creada y membresía, sin guardar celdas originales. Los eventos actuales se conservan y una auditoría de batch resume el proceso. La misma confirmación se serializa y devuelve el mismo batch ante reintentos. Un intento fallido requiere un nuevo preview para reintentar.

`matriz.importar` es global y se combina con permisos globales de consulta/creación de Personas y consulta/creación/gestión de integrantes de Células. Administrador General/Apóstol lo reciben por el mecanismo 0.5; Oficinista no lo recibe automáticamente. Historial y reportes se restringen al usuario que importó. API protege sesión, CSRF e IDOR.

## Validación controlada

Pruebas en PostgreSQL aislado con **411 filas ficticias** que replican columnas y excepciones históricas: **409 Personas creadas, 2 filas omitidas, 409 filas con advertencias, 3 códigos válidos detectados, 2 Células creadas y 307 membresías**. Calidad detectó **409 Personas incompletas y 3 Células activas sin líder**. La Célula histórica cerrada conservó UUID/estado. Cero documentos/celulares «0» persistidos. No se cargó una base real ni se ejecutó esta migración de datos en la demo pública.

Tests: `tests/imports.test.mjs` y `tests/imports-browser.mjs`, incluidos permisos, archivos, firma/IDOR, doble confirmación, rollback, Calidad, mapeo/resolución y temas/responsive 1440/768/390/320. La copia histórica real no fue adjuntada; su validación final corresponde a un entorno autorizado.
