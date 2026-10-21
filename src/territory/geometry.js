export const validLocation=c=>Number.isFinite(c.latitude)&&Number.isFinite(c.longitude)&&Math.abs(c.latitude)<=90&&Math.abs(c.longitude)<=180;
export const mappable=c=>validLocation(c)&&Math.abs(c.latitude)<=85.05112878;
// Great-circle destinations on a mean-radius Earth, not screen-pixel circles.
// 96 edges: maximum chord deviation ~0.054% of the radius (<=54 m at 100 km).
export function coverageRing(c,segments=96){
 if(!mappable(c)||!Number.isFinite(c.coverageRadiusMeters)||c.coverageRadiusMeters<=0||c.coverageRadiusMeters>100000)return [];
 const rad=Math.PI/180,lat=c.latitude*rad,lng=c.longitude*rad,d=c.coverageRadiusMeters/6371008.8,points=[];
 for(let i=0;i<segments;i++){
  const bearing=i*2*Math.PI/segments,nextLat=Math.asin(Math.sin(lat)*Math.cos(d)+Math.cos(lat)*Math.sin(d)*Math.cos(bearing));
  const nextLng=lng+Math.atan2(Math.sin(bearing)*Math.sin(d)*Math.cos(lat),Math.cos(d)-Math.sin(lat)*Math.sin(nextLat));
  points.push([nextLat/rad,nextLng/rad]);
 }
 return points;
}
