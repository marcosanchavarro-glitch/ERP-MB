CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE people (
 id uuid PRIMARY KEY,
 names varchar(100) NOT NULL CHECK(length(trim(names))>0),
 "lastNames" varchar(100) NOT NULL CHECK(length(trim("lastNames"))>0),
 document varchar(30), "documentKey" varchar(30) UNIQUE,
 "birthDate" date, sex text CHECK(sex IS NULL OR sex IN ('FEMENINO','MASCULINO','OTRO','NO_INFORMA')),
 phone varchar(30), "alternatePhone" varchar(30), email varchar(254),
 address varchar(200), locality varchar(100), municipality varchar(100), province varchar(100), "postalCode" varchar(15),
 "joinedDate" date, status text NOT NULL CHECK(status IN ('ACTIVA','INACTIVA')), notes varchar(4000),
 "profileImageKey" text, latitude double precision CHECK(latitude BETWEEN -90 AND 90), longitude double precision CHECK(longitude BETWEEN -180 AND 180), "geocodedAt" timestamptz,
 "nameKey" text NOT NULL, "phoneKey" text NOT NULL, "localityKey" text NOT NULL, "searchText" text NOT NULL, "sortName" text NOT NULL,
 "createdAt" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 CHECK("joinedDate" IS NULL OR "birthDate" IS NULL OR "joinedDate">="birthDate")
);
CREATE INDEX people_sort ON people("sortName",id);
CREATE INDEX people_state ON people(status,"sortName",id);
CREATE INDEX people_locality ON people("localityKey","sortName",id);
CREATE INDEX people_name ON people("nameKey");
CREATE INDEX people_sex ON people(sex,"sortName",id);
CREATE INDEX people_updated ON people("updatedAt",id);
CREATE INDEX people_joined ON people("joinedDate",id);
CREATE INDEX people_search ON people USING gin("searchText" gin_trgm_ops);
CREATE INDEX people_phone_search ON people USING gin("phoneKey" gin_trgm_ops);
CREATE INDEX people_document_search ON people USING gin("documentKey" gin_trgm_ops);
CREATE TABLE person_events (
 id uuid PRIMARY KEY, sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 "personId" uuid NOT NULL REFERENCES people(id), type text NOT NULL, source text NOT NULL,
 summary text NOT NULL, "actorId" text NOT NULL, "occurredAt" timestamptz NOT NULL
);
CREATE INDEX person_events_timeline ON person_events("personId","occurredAt" DESC,sequence DESC);
