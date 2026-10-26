// Public browser configuration only. Backend geocoding keys are never projected.
export function tileProvider(env=process.env){
 const template=env.TERRITORY_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
 const url=new URL(template);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!['{z}','{x}','{y}'].every(k=>template.includes(k)))throw new Error('Invalid public tile configuration');
 const custom=Boolean(env.TERRITORY_TILE_URL)&&url.hostname!=='tile.openstreetmap.org';
 if(custom&&(!env.TERRITORY_TILE_ATTRIBUTION||!env.TERRITORY_TILE_ATTRIBUTION_URL))throw new Error('Public tile attribution required');
 const attributionUrl=env.TERRITORY_TILE_ATTRIBUTION_URL||'https://www.openstreetmap.org/copyright';
 if(new URL(attributionUrl).protocol!=='https:')throw new Error('Invalid attribution URL');
 // A separate public, referrer-restricted key; never reuse the private geocoder key.
 const browserKey=env.GEOAPIFY_MAPS_BROWSER_KEY?.trim();
 const configured=Boolean(browserKey&&/^[A-Za-z0-9_-]{20,200}$/.test(browserKey));
 const styles=['osm-bright','osm-bright-smooth','osm-liberty','positron'];
 const light=styles.includes(env.GEOAPIFY_MAP_STYLE)?env.GEOAPIFY_MAP_STYLE:'osm-bright';
 const style=id=>`https://maps.geoapify.com/v1/styles/${id}/style.json?apiKey=${encodeURIComponent(browserKey)}&attribution=mandatory`;
 const geoapify=configured?{configured:true,light:style(light),dark:style('dark-matter'),lightStyle:light,darkStyle:'dark-matter'}:{configured:false};
 return {requested:'maplibre',geoapify,url:template,origin:url.origin,attribution:env.TERRITORY_TILE_ATTRIBUTION||'© OpenStreetMap contributors',attributionUrl,maxZoom:19};
}
