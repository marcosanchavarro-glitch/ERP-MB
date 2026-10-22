# Territorio 1.1 · Google Maps

## Implementación

HALO usa módulos JavaScript nativos, Express y PostgreSQL; no usa React. La integración oficial se carga bajo demanda, sin agregar React ni paquetes de mapas. `createMapCanvas` es un adaptador con ciclo de vida explícito, reutilizable desde un `useEffect` si más adelante se adopta React (crear una vez, destruir en cleanup). Territorio y el editor de ubicación comparten la carga del SDK por documento. No se descargan Places, Routes, Street View ni Geocoding de Google.

Se prioriza `RenderingType.VECTOR` con Map ID, cartografía estándar y Advanced Markers con los SVG HALO existentes. El navegador/Google pueden usar raster si WebGL no está disponible. `Circle` recibe el radio real en metros. La sede nunca genera cobertura. Las ubicaciones conservan latitud/longitud WGS84 y su verificación existente; no se transforman ni geocodifican nuevamente al abrir el mapa.

Los filtros actualizan datos y overlays, conservando instancia, centro, zoom, selección si el registro sigue autorizado y scroll. Cambiar paneles o coberturas tampoco crea otro mapa. Se libera al salir realmente de la pantalla. Google no ofrece un método público `destroy`: se retiran listeners, overlays, DOM y referencias. Una nueva visita real puede generar otra carga facturable.

El esquema nativo LIGHT/DARK se elige según el tema HALO al crear la instancia. Google no permite cambiar `colorScheme` después. Un cambio de tema durante la visita se aplica al mapa en la siguiente apertura; no se recrea por ese motivo. No hay filtros CSS sobre la cartografía ni se alteran logo, atribuciones o controles de Google.

Si falta configuración, hay rechazo de clave, falla de red o indisponibilidad del SDK, se muestra **un mapa de respaldo OpenStreetMap identificado como tal**, con la misma información y alternativa textual. Leaflet 1.9.4 sigue siendo necesario para ese respaldo; no se retira ni se descarga al usar Google correctamente. Si tampoco carga el respaldo, se informa el fallo y se conserva el listado con reintento. El respaldo no pretende ser Google Maps.

## Configuración manual requerida

1. En un proyecto Google Cloud propio, revisar y aceptar condiciones y configuración de facturación de Maps Platform. **HALO no crea proyectos, recursos, claves ni activa facturación.** Google exige facturación habilitada incluso para usar el cupo sin cargo.
2. Habilitar únicamente **Maps JavaScript API**.
3. Crear un **Map ID JavaScript de tipo Vector**, conservando el estilo estándar. No usar DEMO_MAP_ID en producción.
4. Crear una clave exclusiva para navegador. En Application restrictions seleccionar Websites / HTTP referrers y permitir únicamente los orígenes necesarios: `https://erp-mb-demo.onrender.com/*`, el dominio final y, solo para desarrollo, `http://127.0.0.1:5173/*` / `http://localhost:5173/*`. Con `auth_referrer_policy=origin`, no restringir a rutas internas. Las rutas HALO usan fragmentos y no forman parte del referrer.
5. En API restrictions permitir únicamente **Maps JavaScript API**. Usar claves distintas para desarrollo y demo/producción si es posible.
6. Configurar `GOOGLE_MAPS_BROWSER_KEY` y `GOOGLE_MAPS_MAP_ID` en `.env` local y en Render → Environment. Guardar y desplegar para aplicarlas. No subir valores reales a Git ni compartirlos en el chat. La clave del navegador es visible intencionalmente en el DTO autorizado y la solicitud al SDK; sus restricciones constituyen su protección. No se entrega ninguna clave de servicios backend.
7. Verificar en el dominio autorizado: cartografía Google real, ausencia de errores de clave/referrer/facturación, pines, círculos, selección y cargos en métricas. No considerar operativa la migración solo porque el respaldo o un SDK simulado funcionan.

El servidor habilita CSP para los dominios de Google solo cuando están ambos valores. Los scripts llevan nonce, los workers vectoriales usan `blob:`, no se permite `unsafe-eval`. El documento envía únicamente el origen como referrer cuando Google está configurado; no rutas privadas. Los datos de ubicaciones siguen detrás de permisos efectivos del backend. Coordenadas y vista del mapa se transmiten a Google para representarlos; no se envían nombres de integrantes ni fichas personales.

## Costos y cuotas

**Maps JavaScript API → Dynamic Maps (Essentials)**: una carga exitosa de mapa constituye un evento facturable. La tabla global consultada el 21/10/2026 publica **10.000 cargas mensuales sin cargo** y, en el primer tramo posterior, **USD 7 por cada 1.000 cargas** (hasta 100.000). No es una promesa de costo cero: rigen proyecto, cuenta, región, volumen y condiciones Google. Abrir simultáneamente el mapa general y un editor puede crear dos instancias. Se comparte el SDK, pero cada instancia puede contar. Pan, zoom, filtros y selección no crean mapas nuevos en HALO.

Configurar manualmente en Google Cloud → Maps Platform → Quotas las cuotas disponibles para Maps JavaScript API. Google publica 30.000 consultas/minuto como límite estándar: reducirlo para este proyecto y comprobar si la consola ofrece límites adicionales. No asumir que hay un tope diario/mensual configurable para este SKU. Las cuotas por minuto no garantizan un gasto mensual máximo.

En Billing → Budgets & alerts, crear un presupuesto exclusivo del proyecto, con umbrales, por ejemplo, 50%, 80% y 100%, y destinatarios operativos. **Una alerta no detiene el consumo ni es un límite de gasto.** Revisar métricas por SKU y credencial, restringir dominios, mantener solo las APIs necesarias y deshabilitar manualmente la clave/API si se necesita detener el consumo. No se automatiza suspensión o facturación desde HALO.

## Geocodificación y licencias

Se mantiene **Geoapify** y su caché/confirmación/auditoría; `GEOAPIFY_API_KEY` sigue privada y separada. Geoapify permite almacenamiento y uso con mapas de terceros con las atribuciones correspondientes. Se conservan enlaces de Geoapify/OSM y datos de licencia del resultado, sin sustituir las atribuciones que Google agrega al mapa. Los marcadores representan datos de HALO: la cartografía Google no se descarga ni almacena.

**No se habilita Google Geocoding API**. Cambiarlo requiere otra integración y revisión de sus restricciones de almacenamiento/uso; no debe reutilizarse automáticamente la caché permanente de Geoapify para respuestas de Google.

Fuentes oficiales: [carga del SDK](https://developers.google.com/maps/documentation/javascript/load-maps-js-api), [Advanced Markers](https://developers.google.com/maps/documentation/javascript/advanced-markers/start), [colorScheme inmutable](https://developers.google.com/maps/documentation/javascript/mapcolorscheme), [CSP](https://developers.google.com/maps/documentation/javascript/content-security-policy), [uso y facturación](https://developers.google.com/maps/documentation/javascript/usage-and-billing), [precios](https://developers.google.com/maps/billing-and-pricing/pricing), [SKU](https://developers.google.com/maps/billing-and-pricing/sku-details), [presupuestos y alertas](https://docs.cloud.google.com/billing/docs/how-to/budgets), [Geoapify y mapas de terceros](https://www.geoapify.com/top-geocoding-services-comparison/), [condiciones Geoapify](https://www.geoapify.com/terms-and-conditions/).

## Validación

Las pruebas con SDK simulado verifican el contrato de integración, permisos, ciclo de vida, marcadores, radios y recuperación; no prueban cartografía, restricciones de clave ni facturación reales. La validación real con una clave restringida válida es un paso operativo obligatorio antes de declarar Google Maps funcionando.
