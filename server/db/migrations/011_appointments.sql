CREATE TABLE appointment_recipients (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
 user_id uuid REFERENCES users(id), active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
-- Initial configurable records; scheduling logic never depends on these names.
INSERT INTO appointment_recipients(name) VALUES ('Apóstol Diego'),('Pastora Mariela');
CREATE TABLE appointments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipient_id uuid NOT NULL REFERENCES appointment_recipients(id),
 person_id uuid REFERENCES people(id), newcomer_id uuid REFERENCES newcomers(id), external_name text, external_phone text,
 reason text, date date NOT NULL, time time NOT NULL, duration integer NOT NULL CHECK(duration BETWEEN 5 AND 480),
 status text NOT NULL DEFAULT 'AGENDADA' CHECK(status IN ('AGENDADA','REALIZADA','NO_ASISTIO','CANCELADA')),
 privacy text NOT NULL CHECK(privacy IN ('NORMAL','PRIVADA')),
 followup boolean NOT NULL DEFAULT false, followup_recipient_id uuid REFERENCES appointment_recipients(id), followup_date date, followup_note text,
 created_by uuid NOT NULL REFERENCES users(id), version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(person_id,newcomer_id,external_name)=1),
 CHECK(followup OR (followup_recipient_id IS NULL AND followup_date IS NULL AND followup_note IS NULL)),
 CHECK(NOT followup OR status='REALIZADA'), CHECK(date+time+duration*interval '1 minute'<=date+interval '1 day')
);
CREATE INDEX appointment_agenda ON appointments(date,time,id);
CREATE INDEX appointment_recipient_schedule ON appointments(recipient_id,date,time) WHERE status='AGENDADA';
CREATE INDEX appointment_person ON appointments(person_id,date);
CREATE INDEX appointment_newcomer ON appointments(newcomer_id,date);
CREATE TABLE appointment_events (
 sequence bigserial PRIMARY KEY, id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(), appointment_id uuid REFERENCES appointments(id),
 recipient_id uuid REFERENCES appointment_recipients(id), actor_id uuid NOT NULL REFERENCES users(id),
 action text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(), details jsonb NOT NULL DEFAULT '{}',
 CHECK(num_nonnulls(appointment_id,recipient_id)=1)
);
CREATE INDEX appointment_history ON appointment_events(appointment_id,sequence DESC);
CREATE TRIGGER appointment_history_immutable BEFORE UPDATE OR DELETE ON appointment_events FOR EACH ROW EXECUTE FUNCTION protect_newcomer_history();
INSERT INTO permissions(key) VALUES ('citas.ver'),('citas.detalles'),('citas.gestionar'),('citas.privadas'),('citas.responsables');
INSERT INTO role_permissions(role_id,permission) SELECT r.id,p.key FROM roles r CROSS JOIN permissions p
 WHERE r.name IN ('Oficinista','Oficina administrativa') AND p.key IN ('citas.ver','citas.detalles','citas.gestionar') ON CONFLICT DO NOTHING;
