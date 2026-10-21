CREATE TABLE institutional_sites (
 id text PRIMARY KEY, institution text NOT NULL, name text NOT NULL,
 address text NOT NULL, locality text NOT NULL, province text NOT NULL, country text NOT NULL,
 latitude double precision, longitude double precision, "coordinateStatus" text,
 version integer NOT NULL DEFAULT 1, verification jsonb,
 CHECK ((latitude IS NULL AND longitude IS NULL AND "coordinateStatus" IS NULL) OR
 (latitude BETWEEN -85.05112878 AND 85.05112878 AND longitude BETWEEN -180 AND 180 AND "coordinateStatus" IN ('PENDING','VERIFIED') AND latitude IS NOT NULL AND longitude IS NOT NULL AND "coordinateStatus" IS NOT NULL))
);
INSERT INTO institutional_sites(id,institution,name,address,locality,province,country)
 VALUES('central','Manantial de Bendiciones','Sede Central','Juan Manuel de Rosas 20251','Virrey del Pino','Buenos Aires','Argentina');
CREATE TABLE geocoding_cache (key text PRIMARY KEY, candidates jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE geocoding_usage (day date PRIMARY KEY, requests integer NOT NULL DEFAULT 0, last_request timestamptz);
ALTER TABLE cells ADD COLUMN "locationVerification" jsonb;
