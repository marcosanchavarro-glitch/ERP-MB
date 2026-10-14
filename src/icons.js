// Biblioteca SVG local: trazo uniforme, cuadrícula 24×24, identificadores estables.
// Solo este archivo contiene geometría. La configuración almacena IDs, nunca SVG/HTML.
const paths = {
 home:'m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8', office:'M4 21V3h12v18M16 9h4v12M8 7h4M8 11h4M8 15h4M2 21h20', people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0', music:'M9 18V5l12-2v13M9 8l12-2M9 18a3 3 0 1 1-3-3c1.66 0 3 1.34 3 3M21 16a3 3 0 1 1-3-3c1.66 0 3 1.34 3 3', screen:'M3 4h18v13H3zM8 21h8M12 17v4', door:'M5 21V3h14v18M2 21h20M14 12h1', art:'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4c-1-1 0-3 2-3h2c5 0 3-11-6-11M7 9h.01M11 6h.01M16 8h.01M6 14h.01', spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z', cup:'M4 4h12v11a6 6 0 0 1-12 0ZM16 5h2a3 3 0 0 1 0 6h-2M2 22h18', book:'M12 5v16M12 5C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1', wallet:'M20 8V4H5a3 3 0 0 0 0 6h16v11H5a3 3 0 0 1-3-3V7M21 13h-5v4h5', map:'m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3ZM9 3v15M15 6v15', settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z', arrow:'M5 12h14m-5-5 5 5-5 5', chevron:'m9 5 7 7-7 7', menu:'M4 6h16M4 12h16M4 18h16', close:'m6 6 12 12M6 18 18 6', search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0', bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4', panel:'M3 3h18v18H3ZM9 3v18', layers:'m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5', clock:'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'
};

const metadata = {
  "home": [
    "Inicio",
    [
      "casa",
      "hogar"
    ]
  ],
  "office": [
    "Oficina",
    [
      "edificio",
      "organización"
    ]
  ],
  "people": [
    "Personas",
    [
      "grupo",
      "comunidad",
      "usuarios"
    ]
  ],
  "music": [
    "Música",
    [
      "nota",
      "alabanza"
    ]
  ],
  "screen": [
    "Pantalla",
    [
      "multimedia",
      "transmisión",
      "sonido"
    ]
  ],
  "door": [
    "Recepción",
    [
      "entrada",
      "bienvenida"
    ]
  ],
  "art": [
    "Arte",
    [
      "diseño",
      "pintura",
      "fotografía"
    ]
  ],
  "spark": [
    "Destello",
    [
      "limpieza",
      "nuevo"
    ]
  ],
  "cup": [
    "Comedor",
    [
      "café",
      "servicio"
    ]
  ],
  "book": [
    "Libro",
    [
      "formación",
      "escuela",
      "universitarios"
    ]
  ],
  "wallet": [
    "Billetera",
    [
      "tesorería",
      "recursos"
    ]
  ],
  "map": [
    "Mapa",
    [
      "territorio",
      "células",
      "cobertura"
    ]
  ],
  "settings": [
    "Configuración",
    [
      "ajustes",
      "administración",
      "permisos"
    ]
  ],
  "arrow": [
    "Flecha",
    [
      "dirección",
      "exportar"
    ]
  ],
  "chevron": [
    "Desplegar",
    [
      "menú"
    ]
  ],
  "menu": [
    "Menú",
    [
      "navegación"
    ]
  ],
  "close": [
    "Cerrar",
    [
      "cancelar"
    ]
  ],
  "search": [
    "Buscar",
    [
      "seguimiento",
      "auditoría"
    ]
  ],
  "bell": [
    "Notificaciones",
    [
      "aviso"
    ]
  ],
  "panel": [
    "Panel",
    [
      "dashboard",
      "vista general"
    ]
  ],
  "layers": [
    "Áreas",
    [
      "módulos",
      "secciones"
    ]
  ],
  "clock": [
    "Reloj",
    [
      "asistencia",
      "citas",
      "cumpleaños"
    ]
  ]
};
export const DEFAULT_ICON = 'layers';
export const iconLibrary = Object.freeze(Object.entries(metadata).map(([id, [label, keywords]]) => Object.freeze({id, label, keywords: Object.freeze(keywords)})));
export const isIconId = id => typeof id === 'string' && Object.hasOwn(paths, id);
export function resolveIconId(id, fallback = DEFAULT_ICON) {
  return isIconId(id) ? id : isIconId(fallback) ? fallback : DEFAULT_ICON;
}
const normalize = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
export function searchIcons(query = '') {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return iconLibrary.filter(item => {
    const text = normalize([item.id, item.label, ...item.keywords].join(' '));
    return terms.every(term => text.includes(term));
  });
}
export function icon(name, cls = '') {
  const id = resolveIconId(name);
  const safeClass = String(cls).replace(/[^a-zA-Z0-9 _-]/g, '');
  return `<svg class="icon ${safeClass}" data-icon="${id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[id]}"/></svg>`;
}
export const moduleIcon = module => icon(resolveIconId(module.icon, module.defaultIcon));
