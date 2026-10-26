# Territorio · MapLibre y Geoapify

## Motor y estilo

MapLibre GL JS 6.16.0 (BSD-3-Clause), módulo, CSS y worker servidos localmente. Reutiliza el adaptador de mapa de Territorio y el editor de ubicación; no cambia datos, permisos, geocodificador ni endpoints. Google Maps ya no se carga. Leaflet 1.9.4 permanece exclusivamente como compatibilidad si WebGL o el motor no están disponibles.

El respaldo anterior era raster OSM de 256 px; ampliar esa cartografía no agrega detalle vectorial. No se usan filtros CSS sobre el mapa. Se compararon Geoapify **OSM Bright** y **OSM Bright Smooth** con teselas reales en Virrey del Pino. Se elige **OSM Bright** por sus avenidas diferenciadas, agua celeste y espacios verdes más legibles; Smooth reducía demasiado ese contraste. Oscuro usa **Dark Matter** con ajustes vectoriales de contraste en fondos, calles, edificios y etiquetas, sin invertir imágenes. El cambio de tema conserva la instancia, cámara, pines y coberturas.

La comparación usa la referencia pública de la localidad (-34.8447, -58.6517), **no coordenadas de la sede**. A zoom de calles hay zonas con pocos edificios cartografiados. No se inventan construcciones ni se garantiza detalle uniforme. Capturas reales en `test-results/maplibre/real/`; las capturas `*-fixture.png` son pruebas de interacción con datos simulados y no prueban calidad cartográfica.

## Configuración

- `GEOAPIFY_MAPS_BROWSER_KEY`: clave pública de navegador separada de la del geocodificador. No commitear valores reales. Proyecto «HALO Territorio», plan Free; restricción de Referer `^https://erp-mb-demo\.onrender\.com/.*$`. Agregar otros dominios solo cuando se autoricen. La clave productiva no habilita localhost.
- `GEOAPIFY_MAP_STYLE`: `osm-bright` (seleccionado), `osm-bright-smooth`, `osm-liberty` o `positron`. Lista permitida, sin URLs arbitrarias. Oscuro: `dark-matter`.
- `GEOAPIFY_API_KEY`: sigue siendo privada, solo backend y opcional; **no se sustituye ni se reutiliza para mapas**.

La configuración cartográfica llega mediante los DTO existentes y autorizados. CSP permite solo los orígenes cartográficos necesarios y workers propios, sin `unsafe-eval`; se envía Referer por origen, sin rutas privadas. Los estilos solicitan atribución obligatoria. El control de atribución conserva Geoapify, OpenMapTiles y OpenStreetMap.

Sin clave se muestra raster OSM identificado. Si falla Geoapify se pasa a respaldo con un aviso conservando cámara, selección, filtros y scroll; el cambio de tema no provoca remontajes. No se consultan mapas al navegar por módulos que no los utilizan. Un worker, caché de teselas del motor, sin recargas por filtros, sin perspectiva 3D ni precarga especulativa de teselas expiradas.

## Sede

Al entrar desde otro módulo: sede con coordenadas verificadas y representables → centro en la sede, zoom 16. No se encuadran automáticamente todas las células. Sin sede confirmada: vista regional configurada, sin marcador ficticio y aviso para administradores. «Volver a la sede» está disponible solo cuando existe una sede verificada. Guardar una ubicación, filtrar o abrir detalles no recentra la cámara.

El pin institucional usa exclusivamente `identity.logo`, recurso oficial local configurado mediante `APP_LOGO_PATH`. Si no existe, muestra el texto **Sede** en un marcador destacado; no presenta un símbolo inventado como logo oficial. Selección accesible por teclado y táctil, nombre/dirección en el panel existente. La confirmación de coordenadas sigue en «Configurar sede central»; ningún dato de prueba se escribe en producción.

## Uso y costos

Se confirmó en la cuenta: Free, USD 0/mes, 3.000 créditos/día, hasta 5 solicitudes/segundo. No se agregó tarjeta ni se contrató plan pago. Según la documentación, una solicitud de tesela equivale a 0,25 créditos; una carga implica varias teselas y mover/zoom genera solicitudes adicionales. No son 3.000 usuarios ni 3.000 mapas. Los créditos se comparten entre APIs del proyecto. No se promete un número fijo de visitas ni un bloqueo exacto al alcanzar el cupo; revisar Usage & statistics y las condiciones vigentes antes de aumentar tráfico.

- [Geoapify mapas, atribución y créditos](https://apidocs.geoapify.com/docs/maps/map-tiles/)
- [Geoapify condiciones](https://www.geoapify.com/terms-and-conditions/)
- [MapLibre instalación y worker](https://maplibre.org/maplibre-gl-js/docs/)

## Validación y pendientes

Pruebas dirigidas de proveedor/CSP/permisos y geocodificación, MapLibre real con WebGL/worker y datos cartográficos controlados, compatibilidad sin WebGL, flujo administrativo de ubicaciones, Células y estabilidad del scroll. Breakpoints 320/360/390/430/768/1440, Light/Dark, teclado, cobertura en metros, selección y revocación de acceso. Comparación adicional contra Geoapify real con clave restringida; ningún Google SDK solicitado.

Pendiente de datos institucionales: confirmar la sede mediante el flujo administrativo y proporcionar/configurar su logo oficial. No hay migración de base de datos. La auditoría npm detectó una vulnerabilidad alta **preexistente** de `body-parser` (<2.4.0); MapLibre no agregó avisos de seguridad. Su actualización se trata por separado para respetar el alcance cartográfico.
