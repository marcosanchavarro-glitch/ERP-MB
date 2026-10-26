CREATE TABLE ecclesiastical_offices (
 id text PRIMARY KEY, name text NOT NULL UNIQUE, hierarchy_order integer NOT NULL UNIQUE CHECK(hierarchy_order BETWEEN 1 AND 9), active boolean NOT NULL DEFAULT true
);
INSERT INTO ecclesiastical_offices(id,name,hierarchy_order) VALUES
 ('APOSTLE','Apóstol',1),('INTERNAL_PASTOR','Pastor interno',2),('SENIOR_ELDER','Anciano mayor',3),('MID_ELDER','Anciano medio',4),('ELDER','Anciano',5),('CELL_LEADER','Líder celular',6),('AREA_LEADER','Líder areal',7),('ASSISTANT','Asistente',8),('MEMBER','Miembro',9);
CREATE TRIGGER ecclesiastical_offices_fixed BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON ecclesiastical_offices FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
-- Immutable changes define non-overlapping half-open periods [start, next start).
-- No records are backfilled and no user roles or cellular assignments are modified.
CREATE TABLE ecclesiastical_appointments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 person_id uuid NOT NULL REFERENCES people(id), office_id text NOT NULL REFERENCES ecclesiastical_offices(id),
 effective_date text NOT NULL CHECK(effective_date ~ '^\d{4}-\d{2}-\d{2}$'), actor_id text NOT NULL,
 reason varchar(1000), recorded_at timestamptz NOT NULL DEFAULT now(),
 operation_id uuid NOT NULL UNIQUE, fingerprint text NOT NULL
);
CREATE INDEX ecclesiastical_appointments_person ON ecclesiastical_appointments(person_id,effective_date DESC,sequence DESC);
CREATE TRIGGER ecclesiastical_appointments_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON ecclesiastical_appointments FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
CREATE VIEW ecclesiastical_periods AS SELECT a.*,lead(effective_date) OVER(PARTITION BY person_id ORDER BY effective_date,sequence) AS end_date FROM ecclesiastical_appointments a;
