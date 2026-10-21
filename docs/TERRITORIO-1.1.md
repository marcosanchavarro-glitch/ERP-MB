# Territorio 1.1 — mapa de células

## Integración

Ruta `/territorio/mapa`, en el módulo independiente Territorio. Reutiliza el
shell, menú móvil, sesiones, temas, iconografía, base `cells` y campos de la
migración 014, verificada en PostgreSQL. Sin nuevas migraciones ni cambios en
membresías, líderes, Personas, Mi Célula o reglas funcionales.

Se evaluó MapLibre GL JS como primera alternativa. Para este frontend nativo
ESM, los pines SVG/CSS y geometrías 2D, se eligió Leaflet **1.9.4 estable**:
evita WebGL/workers y un bundler adicional, admite interacción táctil y puede
integrarse también desde React mediante montaje/desmontaje. Se sirve desde la
dependencia local, con carga diferida; no se descarga código desde un CDN.
Referencia: <https://leafletjs.com/reference.html>.

## Proveedor y límites

Teselas raster de OpenStreetMap: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`.
La demo no contrata planes, configura facturación ni usa claves. El servicio
comunitario es de disponibilidad **best effort, sin SLA**, no una capacidad
gratuita ilimitada; puede bloquear uso excesivo. Para crecer o requerir garantías
debe seleccionarse otro proveedor con condiciones apropiadas antes de escalar.
Política: <https://operations.osmfoundation.org/policies/tiles/>.

Atribución visible permanente. Las imágenes usan `referrerPolicy: origin`, por
lo que se identifica el origen de HALO sin enviar rutas ni información celular.
Se conserva `no-referrer` global para los demás recursos. El navegador administra
la caché según las cabeceras del proveedor; sin proxies, descarga offline ni
prefetch de regiones. Leaflet carga el viewport y conserva un margen pequeño
de teselas para la interacción. El proveedor recibe IP y solicitudes de teselas
de la vista; no se envían IDs, direcciones ni GeoJSON de las células.

Configuración pública opcional en servidor: `TERRITORY_TILE_URL`,
`TERRITORY_TILE_ATTRIBUTION`, `TERRITORY_TILE_ATTRIBUTION_URL`. Solo HTTPS, sin
credenciales ni parámetros de consulta en la URL; un proveedor distinto exige
atribución explícita. Esta configuración no aprovisiona servicios. La CSP permite
imágenes del origen configurado, sin habilitar scripts externos o `unsafe-eval`.

## Autorización y privacidad

`GET /api/territory/cells` exige acceso explícito al módulo/subárea de Territorio
mediante el motor existente **y** `celulas.ver`; se respeta su alcance celular.
Administrador General/Apóstol conservan sus habilitaciones actuales. Oficina/HDR
necesitan habilitación efectiva; no se agregan permisos ni se amplían perfiles.
La navegación oculta el mapa cuando falta autorización de consulta geográfica.

Con el modelo actual se separan:

- Entrada al mapa: acceso al módulo/subárea.
- Consulta de ubicaciones exactas y ficha: `celulas.ver` con alcance existente.
- Edición geográfica: `celulas.editar` en la ficha administrativa existente.

El acceso al mapa por sí solo no entrega coordenadas ni habilita edición. No se
implementa un nivel nuevo de ubicación aproximada: falta una política funcional
para eso; no se desplazan coordenadas aleatoriamente. La consulta cartográfica
no incluye dirección completa, referencia del domicilio, anfitriones, teléfonos,
documentos, datos de Personas ni notas administrativas. No hay endpoint público
geográfico ni escrituras desde Territorio.

## Consulta, filtros y rendimiento

Filtros combinables: código, localidad, clasificación F/M explícita, intervalo de
edades recomendado, estado (activas por defecto) y disponibilidad/verificación de
coordenadas. El filtro etario usa intersección de rangos configurados, con límites
abiertos cuando falta un extremo y tratamiento explícito de “sin restricción”.
Un rango desconocido no se presenta como compatible. Es solo un filtro descriptivo,
sin algoritmo de recomendaciones o reglas de membresía.

Una transacción de solo lectura y dos consultas SQL calculan el total autorizado
y recuperan hasta **500 células por página**, en orden estable. El mapa y el
listado representan esa página; se informa el límite y se permite paginar o
refinar filtros. Sin N+1 ni descarga de Personas. Se agrupan marcadores próximos
en una cuadrícula de pantalla a zoom bajo; los grupos indican cantidad y permiten
acercar. Las coordenadas coincidentes se pueden seleccionar en el listado.

## Representación

Pines SVG/CSS con iluminación, sombra, volumen visual y estado seleccionado;
sin objetos 3D reales ni animación permanente. Verificación pendiente también
identificada por trazo discontinuo y texto, no solo color.

Coberturas opcionales mediante polígonos de **96 segmentos**, obtenidos por
destinos de círculo máximo sobre una esfera de radio medio 6371008.8 m. Los
vértices quedan a la distancia configurada; el error máximo de cuerda es aprox.
0.054% del radio (54 m a 100 km), además de la aproximación esférica terrestre.
La proyección cambia el tamaño en pantalla al hacer zoom. No hay radios fijos en
píxeles, cúpulas ni suma de superposiciones como impacto. Deshabilitar coberturas
elimina sus geometrías, no solo su visibilidad.

Coordenadas inválidas o ausentes no generan pines. La proyección Web Mercator
no representa latitudes fuera de ±85.05112878°: se mantienen en la alternativa
textual, identificadas como no representables, sin moverlas a otro lugar.

Sin coordenadas representables no se inicializa un mapa centrado arbitrariamente:
se muestra estado vacío y acceso autorizado a Células. Con datos se ajusta a las
ubicaciones de la página. No se solicita ubicación personal.

Desktop: panel lateral. Móvil: panel inferior en el flujo, filtros plegables y
mapa visible; controles táctiles de 44 px, listado seleccionable por teclado,
foco visible y reduced motion. El mapa base conserva sus colores legibles en
ambos temas; controles y paneles respetan HALO.

## Errores y validación

Carga de datos y mapa diferenciadas; estados vacíos, filtros sin resultados,
403, fallo de red/proveedor y reintento. La alternativa textual sobrevive al fallo
cartográfico. Al fallar la consulta se eliminan datos anteriores. AbortController,
limpieza de mapas/timers/ResizeObserver y eventos ligados a la instancia evitan
actualizaciones tardías al navegar o filtrar.

Pruebas dirigidas de permisos/alcances/revocación, proyección mínima, filtros,
paginación, datos ausentes, configuración pública y distancia de los vértices.
Pruebas Edge: zoom/escala, selección, teclado, filtros, errores, menú móvil,
limpieza, Light/Dark, reduced motion, 320/360/390/430/768/1440 px. Esas pruebas
simulan teselas para no generar tráfico masivo al proveedor. Otra comprobación
puntual usa OSM real y genera capturas con datos de prueba en una base aislada.

Fuera de alcance: iglesias/anexos, recomendaciones, ubicación personal,
asignaciones, evangelización y mapas de calor. No se modifican datos reales para
demostrar la implementación.
