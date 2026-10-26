# Territorio · Marcadores por tipo

## Implementación

`src/territory/markers.js` centraliza las categorías y su presentación, sin persistencia adicional. `locationMarker()` recibe tipo, ID, coordenadas, selección, contexto y recurso visual; devuelve las opciones visuales consumidas por el adaptador cartográfico existente. Los callbacks y los datos permanecen en el controlador. No se infieren tipos a partir del nombre de la entidad.

- **CHURCH**: entidad institucional `central`, pin de mayor jerarquía con relieve, borde y logo configurable.
- **CELL**: entidades del DTO autorizado de células; pin propio con casa minimalista SVG, selección y cobertura geográfica existentes.
- **EVANGELISM, EVENT, POINT_OF_INTEREST**: identificadores reservados, todavía no habilitados ni presentados como funciones o filtros.

El motor de permisos, base de datos, coordenadas confirmadas, geocodificación y proveedor MapLibre/Geoapify no cambian. Solo las ubicaciones verificadas y representables del DTO autorizado generan pines. La sede conserva su posición confirmada; los cambios de filtros y selección no recentran el mapa.

## Logo institucional

No se encontró un logo oficial en el repositorio; `src/favicon.svg` pertenece a HALO y no se reutiliza como logo de la iglesia. Se necesita el archivo oficial **SVG o PNG/WebP/JPG**, preferentemente con transparencia, dentro de `/src/`, por ejemplo `/src/assets/manantial-logo.svg`.

Se configura mediante el mecanismo existente `APP_LOGO_PATH` → `identity.logo`. No se incrusta una marca ni se descarga una imagen de terceros. El pin y el detalle comparten el recurso y usan `object-fit: contain`. Sin archivo, ruta no local o fallo de carga, aparece **Sede · Provisional**. Los recursos del test del logo son sintéticos y nunca se publican como identidad institucional.

## Filtros, leyenda e interacciones

«Filtros del mapa» incorpora **Sedes** y **Células** como controles locales, fuera de los parámetros enviados al backend. Se muestran cuando hay ubicaciones representables de la categoría en los datos autorizados. La leyenda usa los mismos símbolos, compactos y compatibles con claro/oscuro.

Ocultar células oculta sus pines y coberturas; ocultar un tipo seleccionado cierra su detalle. El listado textual sigue disponible. Seleccionar una célula del listado vuelve a habilitar su tipo. «Volver a la sede» vuelve a mostrar la sede si estaba oculta y restaura su cámara. Ninguna de estas acciones consulta nuevamente al backend o crea una instancia de mapa. Los marcadores de las otras categorías permanecen estables.

La aparición inicial y la elevación de selección son breves, sin animaciones infinitas; `prefers-reduced-motion` las desactiva. Se conservan botones accesibles por teclado/tacto y el panel contextual. Seleccionar no habilita edición. Al perder acceso se eliminan mapa, detalles y opciones derivadas de sus datos.

## Validación

Pruebas unitarias de categorías, aislamiento de presentación/datos y recursos locales seguros; navegador con MapLibre y worker reales, controles por tipo, identidad de nodos, cámara, cobertura, tema, errores del proveedor y revocación. Prueba con logo sintético rectangular para verificar proporciones y con recurso 404 para verificar alternativa provisional. Regresiones del respaldo Leaflet, ubicación administrativa y scroll. Breakpoints: 320/360/390/430/768/1440.

Las capturas de fixtures muestran solo bases aisladas; no se agregan células o sedes ficticias a producción. En la demo, la casa aparece cuando existan células con coordenadas verificadas. El logo oficial sigue pendiente de recepción.
