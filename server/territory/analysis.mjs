import {confirmedCoordinates} from './filters.mjs';
import {treeSQL} from './organization.mjs';
// Normalization for matching recorded administrative names, never geocoding or boundary inference.
const key=column=>`translate(lower(trim(coalesce(${column},''))),'áéíóúüñ','aeiouun')`;
export async function territorialAnalysis(db,filter,originalValues,scope,query={}){
 const values=[...originalValues],unitWhere=[],bind=value=>{values.push(value);return '$'+values.length;};
 for(const name of ['country','province','municipality','locality'])if(query[name])unitWhere.push(`u.${name} ILIKE ${bind('%'+query[name].trim().replace(/[\\%_]/g,'\\$&')+'%')}`);
 for(const name of ['zone','sector'])if(query[name])unitWhere.push(`${bind(query[name])}::uuid=ANY(u.path)`);
 const data=(await db.query(`${treeSQL}, base AS (
 SELECT id,gender,country,province,municipality,locality,"recommendedAgeMin","recommendedAgeMax","ageUnrestricted",(${confirmedCoordinates}) IS TRUE located
 FROM cells WHERE ${filter} AND status='ACTIVE'
 ), located AS (
 SELECT count(*)::int total,count(*) FILTER(WHERE located)::int verified,count(*) FILTER(WHERE NOT located)::int pending,
 count(DISTINCT concat_ws(' / ',country,province,municipality,${key('locality')})) FILTER(WHERE nullif(trim(locality),'') IS NOT NULL)::int localities FROM base
 ), distribution AS (
 SELECT 'locality' kind,concat_ws(' / ',country,province,municipality,locality) label,count(*)::int n FROM base GROUP BY country,province,municipality,locality
 UNION ALL SELECT 'classification',coalesce(gender,'UNKNOWN'),count(*)::int FROM base GROUP BY gender
 UNION ALL SELECT 'ages',CASE WHEN "ageUnrestricted" THEN 'Sin restricción etaria' WHEN "recommendedAgeMin" IS NULL AND "recommendedAgeMax" IS NULL THEN 'Sin rango configurado' ELSE coalesce("recommendedAgeMin"::text,'Sin mínimo')||' a '||coalesce("recommendedAgeMax"::text,'sin máximo')||' años' END,count(*)::int FROM base GROUP BY "ageUnrestricted","recommendedAgeMin","recommendedAgeMax"
 UNION ALL SELECT lower(u.level),u.label,count(*)::int FROM base b JOIN cell_territory ct ON ct.cell_id=b.id JOIN tree leaf ON leaf.id=ct.unit_id JOIN tree u ON u.id=ANY(leaf.path) AND u.level IN ('ZONE','SECTOR') GROUP BY u.id,u.level,u.label
 ), unit_counts AS (
 SELECT u.id,count(*)::int n FROM base b JOIN cell_territory ct ON ct.cell_id=b.id JOIN tree leaf ON leaf.id=ct.unit_id JOIN tree u ON u.id=ANY(leaf.path) AND u.level IN ('ZONE','SECTOR') GROUP BY u.id
 UNION ALL SELECT u.id,count(*)::int FROM base b LEFT JOIN cell_territory ct ON ct.cell_id=b.id LEFT JOIN tree leaf ON leaf.id=ct.unit_id JOIN tree u ON
 (u.id=ANY(leaf.path) OR (${key('u.country')}=${key('b.country')} AND ${key('u.province')}=${key('b.province')} AND ${key('u.municipality')}=${key('b.municipality')} AND ${key('u.locality')}=${key('b.locality')}))
 WHERE u.level='LOCALITY' GROUP BY u.id
 ), visible_units AS (SELECT DISTINCT unnest(leaf.path) id FROM cell_territory ct JOIN tree leaf ON leaf.id=ct.unit_id WHERE ct.cell_id=ANY($2::uuid[])), presence AS (
 SELECT u.id,u.level,u.name,u.label,u.locality,u.active,u.survey_status,coalesce(n.n,0) cells
 FROM tree u LEFT JOIN unit_counts n ON n.id=u.id
 WHERE u.active AND u.level IN ('LOCALITY','ZONE','SECTOR') AND ($1 OR u.id IN (SELECT id FROM visible_units)) ${unitWhere.length?'AND '+unitWhere.join(' AND '):''}
 ) SELECT (SELECT row_to_json(located) FROM located) summary,
 coalesce((SELECT jsonb_agg(d ORDER BY kind,n DESC,label) FROM (SELECT * FROM distribution ORDER BY kind,n DESC,label LIMIT 500) d),'[]') distributions,
 coalesce((SELECT jsonb_agg(p ORDER BY cells,label) FROM (SELECT * FROM presence ORDER BY cells,label LIMIT 500) p),'[]') presence`,values)).rows[0];
 return {...data,completeScope:scope.all,limitedLists:true};
}
