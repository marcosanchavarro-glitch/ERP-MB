-- Private coordinates are deliberately excluded from ordinary person projections.
ALTER TABLE people ADD COLUMN "geoLocation" jsonb;
ALTER TABLE people ADD CONSTRAINT people_geo_location_shape CHECK (
 "geoLocation" IS NULL OR (
 jsonb_typeof("geoLocation")='object' AND
 jsonb_typeof("geoLocation"->'latitude')='number' AND
 jsonb_typeof("geoLocation"->'longitude')='number' AND
 ("geoLocation"->>'latitude')::double precision BETWEEN -85.05112878 AND 85.05112878 AND
 ("geoLocation"->>'longitude')::double precision BETWEEN -180 AND 180 AND
 "geoLocation" ? 'addressFingerprint' AND "geoLocation" ? 'verification'
 ) IS TRUE
);
