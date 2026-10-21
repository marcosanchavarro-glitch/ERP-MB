-- Habitual cell location only; no leader/person address is copied or geocoded.
ALTER TABLE cells
 ADD COLUMN country varchar(100),
 ADD COLUMN "coordinateStatus" text,
 ADD COLUMN "locationUpdatedAt" timestamptz,
 ADD COLUMN "recommendedAgeMin" integer,
 ADD COLUMN "recommendedAgeMax" integer,
 ADD COLUMN "ageUnrestricted" boolean,
 ADD COLUMN "coverageRadiusMeters" double precision,
 ADD CONSTRAINT cells_coordinate_pair CHECK (
  (latitude IS NULL AND longitude IS NULL) OR
  (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
 ) NOT VALID,
 ADD CONSTRAINT cells_coordinate_state CHECK (
  "coordinateStatus" IS NULL OR
  ("coordinateStatus" IN ('PENDING','VERIFIED') AND latitude IS NOT NULL AND longitude IS NOT NULL)
 ),
 ADD CONSTRAINT cells_recommended_ages CHECK (
  ("recommendedAgeMin" IS NULL OR "recommendedAgeMin">=0) AND
  ("recommendedAgeMax" IS NULL OR "recommendedAgeMax">=0) AND
  ("recommendedAgeMin" IS NULL OR "recommendedAgeMax" IS NULL OR "recommendedAgeMin"<="recommendedAgeMax") AND
  ("ageUnrestricted" IS NOT TRUE OR ("recommendedAgeMin" IS NULL AND "recommendedAgeMax" IS NULL))
 ),
 ADD CONSTRAINT cells_reference_radius CHECK ("coverageRadiusMeters" IS NULL OR "coverageRadiusMeters">0 AND "coverageRadiusMeters"<=100000);
-- Existing coordinates were previously unconstrained: preserve legacy rows without
-- claiming they are verified. New writes must satisfy the pair/range constraint.
CREATE INDEX cells_verified_location ON cells(id) WHERE status='ACTIVE' AND "coordinateStatus"='VERIFIED';
