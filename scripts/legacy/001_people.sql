CREATE TABLE people (
 id TEXT PRIMARY KEY,
 names TEXT NOT NULL CHECK(length(trim(names)) > 0),
 lastNames TEXT NOT NULL CHECK(length(trim(lastNames)) > 0),
 document TEXT,
 documentKey TEXT UNIQUE,
 birthDate TEXT,
 sex TEXT CHECK(sex IS NULL OR sex IN ('FEMENINO','MASCULINO','OTRO','NO_INFORMA')),
 phone TEXT, alternatePhone TEXT, email TEXT,
 address TEXT, locality TEXT, municipality TEXT, province TEXT, postalCode TEXT,
 joinedDate TEXT, status TEXT NOT NULL CHECK(status IN ('ACTIVA','INACTIVA')),
 notes TEXT,
 profileImageKey TEXT,
 latitude REAL CHECK(latitude IS NULL OR latitude BETWEEN -90 AND 90),
 longitude REAL CHECK(longitude IS NULL OR longitude BETWEEN -180 AND 180),
 geocodedAt TEXT,
 nameKey TEXT NOT NULL, phoneKey TEXT NOT NULL, localityKey TEXT NOT NULL,
 searchText TEXT NOT NULL, sortName TEXT NOT NULL,
 createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX people_sort ON people(sortName, id);
CREATE INDEX people_state ON people(status, sortName);
CREATE INDEX people_locality ON people(localityKey, sortName);
CREATE INDEX people_name ON people(nameKey);
CREATE TABLE person_events (
 id TEXT PRIMARY KEY,
 personId TEXT NOT NULL REFERENCES people(id),
 type TEXT NOT NULL, source TEXT NOT NULL,
 summary TEXT NOT NULL, actorId TEXT NOT NULL, occurredAt TEXT NOT NULL
);
CREATE INDEX person_events_timeline ON person_events(personId, occurredAt DESC);
CREATE TABLE person_audit_changes (
 id TEXT PRIMARY KEY,
 personId TEXT NOT NULL REFERENCES people(id),
 actorId TEXT NOT NULL,
 occurredAt TEXT NOT NULL,
 changes TEXT NOT NULL
);
