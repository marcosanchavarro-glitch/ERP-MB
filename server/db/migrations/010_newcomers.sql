CREATE TABLE newcomers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 name_key text NOT NULL, phone_key text NOT NULL DEFAULT '', arrival_date date NOT NULL,
 phase text NOT NULL DEFAULT 'PENDIENTE_CONTACTO' CHECK(phase IN ('PENDIENTE_CONTACTO','EN_SEGUIMIENTO','DERIVADO_CELULA','ARCHIVADO','INTEGRADO')),
 recorded_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 version integer NOT NULL DEFAULT 1 CHECK(version>0), person_id uuid UNIQUE REFERENCES people(id), integrated_at timestamptz, integrated_by uuid REFERENCES users(id),
 CHECK((phase='INTEGRADO')=(person_id IS NOT NULL))
);
CREATE INDEX newcomers_name ON newcomers(name_key);
CREATE INDEX newcomers_phone ON newcomers(phone_key) WHERE phone_key<>'';
CREATE INDEX newcomers_arrival ON newcomers(arrival_date DESC,id);
CREATE TABLE newcomer_referrals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), newcomer_id uuid NOT NULL REFERENCES newcomers(id), cell_id uuid NOT NULL REFERENCES cells(id),
 start_date date NOT NULL, end_date date, actor_id uuid NOT NULL REFERENCES users(id), reason text,
 CHECK(end_date IS NULL OR end_date>=start_date)
);
CREATE UNIQUE INDEX newcomer_one_referral ON newcomer_referrals(newcomer_id) WHERE end_date IS NULL;
CREATE INDEX newcomer_cell_period ON newcomer_referrals(cell_id,start_date,end_date);
CREATE TABLE newcomer_attendance (
 newcomer_id uuid NOT NULL REFERENCES newcomers(id), meeting_id uuid NOT NULL REFERENCES cell_meetings(id), referral_id uuid NOT NULL REFERENCES newcomer_referrals(id),
 status text NOT NULL CHECK(status IN ('PRESENT','ABSENT')), actor_id uuid NOT NULL REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(newcomer_id,meeting_id)
);
CREATE INDEX newcomer_meeting ON newcomer_attendance(meeting_id);
CREATE TABLE welcome_coffees (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), date date NOT NULL, title text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'PLANIFICADO' CHECK(status IN ('PLANIFICADO','REALIZADO','CANCELADO')), notes text,
 version integer NOT NULL DEFAULT 1, actor_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE welcome_guests (
 coffee_id uuid NOT NULL REFERENCES welcome_coffees(id), newcomer_id uuid NOT NULL REFERENCES newcomers(id),
 attended boolean NOT NULL DEFAULT false, actor_id uuid NOT NULL REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(coffee_id,newcomer_id)
);
CREATE INDEX welcome_guest_newcomer ON welcome_guests(newcomer_id);
CREATE TABLE newcomer_events (
 sequence bigserial PRIMARY KEY,id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),newcomer_id uuid REFERENCES newcomers(id), coffee_id uuid REFERENCES welcome_coffees(id),
 action text NOT NULL,actor_id uuid NOT NULL REFERENCES users(id), occurred_at timestamptz NOT NULL DEFAULT now(), details jsonb NOT NULL DEFAULT '{}',
 CHECK(newcomer_id IS NOT NULL OR coffee_id IS NOT NULL)
);
CREATE INDEX newcomer_history ON newcomer_events(newcomer_id,sequence DESC);
CREATE VIEW newcomer_progress AS
 SELECT n.*,r.cell_id AS "cellId",c."displayCode",
 (SELECT count(*)::int FROM newcomer_attendance a JOIN cell_meetings m ON m.id=a.meeting_id WHERE a.newcomer_id=n.id AND a.status='PRESENT' AND m.date>=n.arrival_date AND m.status IN ('RECORDED','CLOSED') AND m.date<=(now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) AS attendances,
 (SELECT min(c.date)::text FROM welcome_guests g JOIN welcome_coffees c ON c.id=g.coffee_id WHERE g.newcomer_id=n.id AND g.attended AND c.date>=n.arrival_date AND c.status='REALIZADO' AND c.date<=(now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) AS "coffeeDate",
 EXISTS(SELECT 1 FROM newcomer_events e WHERE e.newcomer_id=n.id AND e.action='CONTACT' AND e.details->>'established'='true') AS contacted
 FROM newcomers n LEFT JOIN newcomer_referrals r ON r.newcomer_id=n.id AND r.end_date IS NULL LEFT JOIN cells c ON c.id=r.cell_id;
CREATE FUNCTION protect_newcomer_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'El historial de Nuevos es inmutable'; END; $$;
CREATE TRIGGER newcomer_history_immutable BEFORE UPDATE OR DELETE ON newcomer_events FOR EACH ROW EXECUTE FUNCTION protect_newcomer_history();
INSERT INTO permissions(key) VALUES ('nuevos.registrar'),('nuevos.ver'),('nuevos.gestionar'),('nuevos.consolidar'),('nuevos.cafe');
INSERT INTO roles(id,name) VALUES(gen_random_uuid(),'Recepción') ON CONFLICT(name) DO NOTHING;
INSERT INTO role_permissions(role_id,permission) SELECT r.id,p.key FROM roles r CROSS JOIN permissions p
 WHERE (r.name IN ('Oficinista','Oficina administrativa') AND p.key LIKE 'nuevos.%') OR (r.name='Recepción' AND p.key='nuevos.registrar') ON CONFLICT DO NOTHING;

-- Saving the separate newcomer roster versions an open meeting without closing it.
CREATE OR REPLACE FUNCTION protect_meeting_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id<>OLD.id OR NEW."cellId"<>OLD."cellId" OR NEW.week<>OLD.week OR NEW."createdAt"<>OLD."createdAt" OR NEW."createdBy"<>OLD."createdBy" THEN RAISE EXCEPTION 'Meeting identity is immutable' USING ERRCODE='23514'; END IF;
 IF OLD.status<>'SCHEDULED' AND (NEW.date<>OLD.date OR NEW.time<>OLD.time OR NEW."scheduleId"<>OLD."scheduleId") THEN RAISE EXCEPTION 'Historical schedule is immutable' USING ERRCODE='23514'; END IF;
 IF OLD."snapshotAt" IS NOT NULL AND NEW."snapshotAt" IS DISTINCT FROM OLD."snapshotAt" THEN RAISE EXCEPTION 'Snapshot time is immutable' USING ERRCODE='23514'; END IF;
 IF NOT ((OLD.status='SCHEDULED' AND NEW.status IN ('SCHEDULED','OPEN','CANCELLED')) OR (OLD.status='OPEN' AND NEW.status IN ('OPEN','RECORDED','CANCELLED')) OR (OLD.status='RECORDED' AND NEW.status IN ('RECORDED','CLOSED','CANCELLED')) OR (OLD.status='CLOSED' AND NEW.status='RECORDED')) THEN RAISE EXCEPTION 'Invalid meeting transition' USING ERRCODE='23514'; END IF;
 IF OLD.status='CLOSED' AND NEW.notes IS DISTINCT FROM OLD.notes THEN RAISE EXCEPTION 'Reopen before editing' USING ERRCODE='23514'; END IF;
 IF NEW.status IN ('RECORDED','CLOSED') AND EXISTS(SELECT 1 FROM meeting_attendance WHERE "meetingId"=NEW.id AND status IS NULL) THEN RAISE EXCEPTION 'Attendance is incomplete' USING ERRCODE='23514'; END IF;
 IF NEW.status='CANCELLED' AND EXISTS(SELECT 1 FROM meeting_attendance WHERE "meetingId"=NEW.id AND status IS NOT NULL) THEN RAISE EXCEPTION 'Cancelled meeting cannot produce absences' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
