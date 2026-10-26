CREATE TABLE evangelism_outings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title varchar(160) NOT NULL,
 date date NOT NULL, start_time time NOT NULL, end_time time,
 responsible_id uuid NOT NULL REFERENCES users(id), organizer varchar(140),
 participant_count integer CHECK(participant_count BETWEEN 0 AND 100000),
 unit_id uuid NOT NULL REFERENCES territory_units(id),
 description varchar(2000), notes varchar(2000),
 status text NOT NULL DEFAULT 'PLANNED' CHECK(status IN ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED')),
 cancellation_reason varchar(1000), version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_by uuid NOT NULL REFERENCES users(id), updated_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(end_time IS NULL OR end_time>=start_time),
 CHECK((status='CANCELLED')=(cancellation_reason IS NOT NULL))
);
CREATE INDEX evangelism_outings_date ON evangelism_outings(date DESC,id);
CREATE INDEX evangelism_outings_unit ON evangelism_outings(unit_id,date);
CREATE INDEX evangelism_outings_responsible ON evangelism_outings(responsible_id,date);
CREATE TABLE evangelism_participants (
 outing_id uuid NOT NULL REFERENCES evangelism_outings(id),
 person_id uuid NOT NULL REFERENCES people(id), PRIMARY KEY(outing_id,person_id)
);
CREATE TABLE evangelism_routes (
 outing_id uuid PRIMARY KEY REFERENCES evangelism_outings(id),
 geometry jsonb NOT NULL CHECK((jsonb_typeof(geometry)='object' AND geometry->>'type'='LineString' AND jsonb_typeof(geometry->'coordinates')='array' AND jsonb_array_length(geometry->'coordinates') BETWEEN 2 AND 500) IS TRUE),
 length_meters double precision NOT NULL CHECK(length_meters BETWEEN 0 AND 1000000),
 source text NOT NULL DEFAULT 'MANUAL' CHECK(source='MANUAL'),
 format_version integer NOT NULL DEFAULT 1 CHECK(format_version=1),
 updated_by uuid NOT NULL REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE evangelism_events (
 sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, outing_id uuid NOT NULL REFERENCES evangelism_outings(id),
 action text NOT NULL, actor_id uuid NOT NULL REFERENCES users(id), occurred_at timestamptz NOT NULL DEFAULT now(),
 fields jsonb NOT NULL DEFAULT '[]'
);
CREATE INDEX evangelism_events_outing ON evangelism_events(outing_id,sequence DESC);
CREATE TRIGGER evangelism_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON evangelism_events FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
INSERT INTO permissions(key) VALUES('evangelismo.ver'),('evangelismo.crear'),('evangelismo.editar'),('evangelismo.recorridos'),('evangelismo.estados'),('evangelismo.estadisticas');
-- Existing technical profile policy applies. No ecclesiastical rank is read or assigned.
