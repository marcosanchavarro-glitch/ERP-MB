// Public raster configuration only: never pass server credentials to the browser.
export function tileProvider(env=process.env){
 const template=env.TERRITORY_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
 const url=new URL(template);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!['{z}','{x}','{y}'].every(k=>template.includes(k)))throw new Error('Invalid public tile configuration');
 const custom=Boolean(env.TERRITORY_TILE_URL)&&url.hostname!=='tile.openstreetmap.org';
 if(custom&&(!env.TERRITORY_TILE_ATTRIBUTION||!env.TERRITORY_TILE_ATTRIBUTION_URL))throw new Error('Public tile attribution required');
 const attributionUrl=env.TERRITORY_TILE_ATTRIBUTION_URL||'https://www.openstreetmap.org/copyright';
 if(new URL(attributionUrl).protocol!=='https:')throw new Error('Invalid attribution URL');
 return {url:template,origin:url.origin,attribution:env.TERRITORY_TILE_ATTRIBUTION||'© OpenStreetMap contributors',attributionUrl,maxZoom:19};
}
