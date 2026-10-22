// Public browser configuration only. Backend geocoding keys are never projected.
export function tileProvider(env=process.env){
 const template=env.TERRITORY_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
 const url=new URL(template);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!['{z}','{x}','{y}'].every(k=>template.includes(k)))throw new Error('Invalid public tile configuration');
 const custom=Boolean(env.TERRITORY_TILE_URL)&&url.hostname!=='tile.openstreetmap.org';
 if(custom&&(!env.TERRITORY_TILE_ATTRIBUTION||!env.TERRITORY_TILE_ATTRIBUTION_URL))throw new Error('Public tile attribution required');
 const attributionUrl=env.TERRITORY_TILE_ATTRIBUTION_URL||'https://www.openstreetmap.org/copyright';
 if(new URL(attributionUrl).protocol!=='https:')throw new Error('Invalid attribution URL');
 const browserKey=env.GOOGLE_MAPS_BROWSER_KEY?.trim(),mapId=env.GOOGLE_MAPS_MAP_ID?.trim();
 const valid=browserKey&&mapId&&/^[A-Za-z0-9_-]{20,200}$/.test(browserKey)&&/^[A-Za-z0-9_-]{4,100}$/.test(mapId);
 const google=valid?{configured:true,apiKey:browserKey,mapId}:{configured:false};
 return {requested:'google',google,url:template,origin:url.origin,attribution:env.TERRITORY_TILE_ATTRIBUTION||'© OpenStreetMap contributors',attributionUrl,maxZoom:19};
}
