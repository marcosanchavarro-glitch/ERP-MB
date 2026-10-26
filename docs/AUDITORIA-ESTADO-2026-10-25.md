# HALO · Auditoría de estado

Fecha de revisión: 25/10/2026, America/Buenos_Aires. Commit local y publicado: `6a5eabc96e2a3edc795be6fbcdf667953a8f59b9`. Servicio Render `erp-mb-demo`, plan Free. Revisión sin cambios de código de aplicación, credenciales, configuración del servicio ni registros de negocio.

## Resultado

Existe un fallo real de arranque de la interfaz en el entorno observado. El backend, la autenticación y las pantallas comprobadas responden cuando sus recursos llegan a cargarse. No corresponde declarar el sistema completamente sano basándose solo en las pruebas locales o en el health check.

## Hallazgos prioritarios

### Alta · Pantalla en blanco al ingresar

La pestaña real del usuario muestra únicamente el fondo y «Saltar al contenido». `#app` permanece vacío, documento completo, sin formulario de acceso ni aviso de recuperación. Se reprodujo después de recargar esa misma pestaña.

La prueba independiente en Edge con protocolo predeterminado reproduce `net::ERR_HTTP2_SERVER_REFUSED_STREAM` al solicitar `/src/app.js` y diez hojas CSS, entre ellas las de Células, Oficina, Territorio y estilos globales. El formulario no aparece dentro de 18 segundos. Con HTTP/1.1 aparece sin descargas fallidas.

`index.html:16` deja `#app` vacío y depende de la descarga y ejecución del módulo principal. `src/app.js:1` importa de forma estática los controladores de numerosas áreas; el manejo de errores de identidad empieza después de resolver esos imports, por lo que no cubre una descarga fallida del propio módulo o de sus dependencias.

**Conclusión comprobada:** el fallo observado impide arrancar la interfaz y está asociado a rechazos de streams HTTP/2. **Pendiente de determinar:** qué elemento exacto de la ruta navegador/red/proxy/CDN origina esos rechazos; no se demostró que Express o Render, por sí solos, sean responsables. La diferencia entre protocolos es evidencia de diagnóstico, no una corrección ni una indicación para desactivar HTTP/2 a los usuarios.

Prioridad: robustecer la entrega del arranque y sus recursos, reducir solicitudes iniciales innecesarias y proporcionar un estado de error recuperable si el módulo no inicia. Validar posteriormente con HTTP/2 normal, recarga y enlace externo, además de móvil. No atribuir el problema a las contraseñas.

Evidencia local: `test-results/audit/startup.json`, `test-results/audit/startup-default.png` y `test-results/audit-startup.log`.

### Alta · Dependencia vulnerable

`npm audit` identifica una vulnerabilidad alta en `body-parser@2.3.0`, dependencia transitiva de `express@5.3.0`. Está fijada en `package-lock.json:571`. El aviso describe una denegación de servicio al procesar determinados cuerpos comprimidos. Versión corregida: 2.4.0.

El servidor utiliza `express.json()` en `server/http.mjs`, sin deshabilitar la descompresión. Es una dependencia utilizada, no solamente de desarrollo. No se enviaron cargas de explotación a la demo; no hay evidencia de un ataque ni de un crash causado por esta vulnerabilidad durante la revisión.

Prioridad: actualizar la dependencia resuelta a una versión corregida y ejecutar pruebas de API/autenticación/importación. No aplicar `npm audit fix` indiscriminadamente.

Fuente primaria: [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828).

## Comprobaciones satisfactorias

- `/health/ready` responde 200; la base de datos está disponible.
- El usuario guardado `demo.admin` autentica correctamente. No se cambiaron ni reprodujeron contraseñas en este informe.
- El acceso anónimo a la API de Territorio responde 401.
- Render: servicio sin suspensión, último despliegue Live. Muestras de memoria aproximadas: 77–83 MB sobre 512 MB. CPU baja. No aparecieron logs de aplicación de nivel error en las consultas realizadas; eso no descarta fallos del navegador o de la red.
- Navegación publicada, usando HTTP/1.1 para aislar el fallo de transporte: Personas, Células, Asistencia, Seguimiento, Nuevos, Cumpleaños, Calidad, Citas, Importar/Exportar, Dashboard, Usuarios y mapa de Territorio. Sin errores HTTP de API ni excepciones JavaScript observadas. Sin overflow global a 390 px en la pantalla comprobada.
- La navegación de auditoría bloqueó cualquier escritura de negocio. No hubo intentos bloqueados. Se evitaron Inicio y Mi Célula porque pueden preparar reuniones al entrar.
- La suite general ya registrada para esta entrega aprobó 184/184. No se repitió durante la auditoría, al no existir cambios de implementación posteriores. Se volvió a ejecutar la suite de navegador de autenticación: enlace externo, acceso responsive, contraseña incorrecta, cookies HttpOnly, revocación, borradores, logout y acceso denegado: PASS, en base PostgreSQL aislada.
- La entrega previa aprobó seis suites de navegador y la prueba publicada de MapLibre/Geoapify real en claro/oscuro, 390/1440, sin Google Maps. Es evidencia de esas pruebas concretas, no de que todas las funciones estén libres de defectos.

## Pendientes de configuración institucional

La sede no tiene coordenadas verificadas almacenadas y no hay logo oficial configurado. Por eso se muestra la referencia regional y «Volver a la sede» no está disponible. El comportamiento es deliberado: faltan datos confirmados, no corresponde inventarlos. Geoapify cartográfico sí está configurado y en plan Free.

## Límites

Auditoría de arranque, transporte, despliegue, recursos, autenticación, navegación de lectura y dependencias. No es una prueba de penetración integral, una prueba de carga ni una validación manual exhaustiva de altas/ediciones. No se realizaron operaciones destructivas ni cambios en cuentas reales. No se demostró corrupción o pérdida de datos.
