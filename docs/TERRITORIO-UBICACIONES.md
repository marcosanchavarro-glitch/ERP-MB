# Territorio: sede y confirmación de ubicaciones

La migración 015 registra la dirección oficial de la Sede Central en `institutional_sites`, separada de las células. No agrega coordenadas ni células de muestra. La tabla admite futuras sedes; esta entrega solo administra la central. Edición desde **Territorio → Mapa de células → Configurar sede central**, con autorización administrativa existente y acceso a Territorio. Las células usan su formulario habitual, sección **Ubicación y compatibilidad**.

## Geocodificación

Proveedor: **Geoapify**, consultado exclusivamente desde el backend con `GEOAPIFY_API_KEY`. Sin clave, la búsqueda informa la configuración pendiente y sigue disponible la ubicación manual. No hay geocodificación al abrir mapas, renderizar pantallas ni migrar la base.

Se envían calle/altura, localidad, provincia y país; se excluyen nombres de personas, teléfonos, notas y referencias privadas. Se separa una altura final inequívoca del campo Dirección; se incluyen todos los demás componentes. Se prioriza Argentina y se filtra por ese país cuando corresponde. La dirección guardada nunca se sustituye con la respuesta del proveedor.

**Buscar ubicación** presenta hasta cinco candidatos sin selección automática. Indica coincidencia de dirección/altura, calle aproximada o localidad. Una coincidencia precisa exige altura, localidad y alta confianza de calle y edificio. Los resultados aproximados siguen rotulados como aproximados después de confirmarlos. El usuario elige un candidato y puede arrastrar el pin, hacer clic en el mapa o editar coordenadas para corregirlo sin mouse. **Confirmar punto para guardar** prepara la confirmación; **Guardar** persiste punto, precisión, proveedor, candidato elegido, actor y fecha. Cambiar dirección o coordenadas invalida la confirmación anterior. La búsqueda no verifica ni guarda coordenadas. Correcciones y consultas se auditan con el mecanismo existente.

Se conservan solo coordenadas, precisión, etiqueta y datos de atribución/licencia del candidato; no la respuesta completa. La caché persistente usa un hash de la dirección normalizada, compartido para evitar duplicaciones incluso entre peticiones concurrentes. No se reconsulta una dirección ya buscada. Las consultas fallidas permiten reintentar; también consumen el presupuesto local. Los logs técnicos no incluyen direcciones ni claves.

## Límites y configuración

- `GEOAPIFY_API_KEY`: clave privada de un proyecto Free, nunca se entrega al navegador.
- `GEOCODING_DAILY_LIMIT`: presupuesto diario local; predeterminado 250, máximo 3000. Cuenta persistente por día UTC de la base. Límite por IP: 10 búsquedas/minuto; límite global de salida: una cada 250 ms; tiempo de espera: 6 segundos. Todos los procesos comparten presupuesto y caché mediante PostgreSQL.
- `TERRITORY_REFERENCE_LATITUDE`, `TERRITORY_REFERENCE_LONGITUDE`, `TERRITORY_REFERENCE_ZOOM`, `TERRITORY_REFERENCE_LABEL`: encuadre regional sin marcadores; valores iniciales Buenos Aires, -34.8/-58.6, zoom 10. **No son coordenadas de la iglesia.**

Geoapify permite almacenar resultados conservando las atribuciones. Su plan Free anuncia 3000 créditos diarios y hasta 5 peticiones/segundo; una geocodificación consume un crédito. No se contrata ni activa facturación. Otras aplicaciones que compartan la misma clave consumen su cuota independientemente de este contador; usar una clave dedicada. Revisar condiciones antes de cambiar proveedor o plan.

Fuentes oficiales consultadas el 21/10/2026: [API](https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/), [almacenamiento y atribución](https://www.geoapify.com/geocoding-api/), [plan Free](https://www.geoapify.com/pricing/). La interfaz conserva enlaces a Geoapify y OpenStreetMap y la atribución recibida.

## Mapa

Siempre se inicializa el mapa base. Solo las ubicaciones confirmadas tienen marcador. La sede usa un SVG volumétrico propio, sin cobertura. Primer encuadre: sede y células confirmadas; solo sede a zoom 16; solo células ajustadas; ninguna ubicación, referencia regional explícita. El aviso sin células no tapa el mapa. Filtros y recargas locales mantienen la instancia, zoom y centro; **Recentrar vista** ajusta voluntariamente el encuadre. No se fuerza desplazamiento al seleccionar un marcador.

## Validación y pendiente operativo

Pruebas backend y navegador usan bases aisladas, proveedor y teselas simulados. Sus coordenadas son fixtures y **no verifican la ubicación real de la sede**. Sin clave configurada no se verificó ninguna coordenada real de Juan Manuel de Rosas 20251. Configurar la clave Free y confirmar administrativamente el resultado, o ubicar y confirmar manualmente el punto con conocimiento de la dirección.
