CREATE TABLE departmental_activities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),unit_id uuid NOT NULL REFERENCES organizational_units(id),title varchar(160) NOT NULL,
 description varchar(2000),activity_date text NOT NULL,start_time text NOT NULL,venue varchar(200),responsible_id uuid NOT NULL REFERENCES people(id),
 status text NOT NULL DEFAULT 'SCHEDULED' CHECK(status IN('SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED')),
 notes varchar(2000),cancellation_reason varchar(1000),version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_by uuid NOT NULL REFERENCES users(id),updated_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(activity_date ~ '^\d{4}-\d{2}-\d{2}$'),CHECK(start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),CHECK((status='CANCELLED')=(cancellation_reason IS NOT NULL))
);
CREATE INDEX departmental_activities_unit_date ON departmental_activities(unit_id,activity_date,start_time,id);
CREATE TABLE departmental_activity_participants(activity_id uuid NOT NULL REFERENCES departmental_activities(id),person_id uuid NOT NULL REFERENCES people(id),PRIMARY KEY(activity_id,person_id));
CREATE TABLE departmental_activity_events (
 sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,activity_id uuid NOT NULL REFERENCES departmental_activities(id),unit_id uuid NOT NULL REFERENCES organizational_units(id),
 actor_id uuid NOT NULL REFERENCES users(id),action text NOT NULL,occurred_at timestamptz NOT NULL DEFAULT now(),before_value jsonb,after_value jsonb,
 operation_id uuid NOT NULL UNIQUE,fingerprint text NOT NULL,result jsonb NOT NULL
);
CREATE INDEX departmental_events_activity ON departmental_activity_events(activity_id,sequence DESC);
CREATE TRIGGER departmental_activity_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON departmental_activity_events FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
INSERT INTO permissions(key) VALUES('departamentos.ver'),('departamentos.gestionar');
