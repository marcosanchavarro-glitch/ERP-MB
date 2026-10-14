CREATE TABLE cell_schedules (
 id uuid PRIMARY KEY, "cellId" uuid NOT NULL REFERENCES cells(id), "effectiveWeek" date NOT NULL,
 day text CHECK(day IN ('0','1','2','3','4','5','6')), time text CHECK(time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 "actorId" text NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(), sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE
);
CREATE INDEX cell_schedule_effective ON cell_schedules("cellId","effectiveWeek" DESC,sequence DESC);
INSERT INTO cell_schedules(id,"cellId","effectiveWeek",day,time,"actorId")
 SELECT gen_random_uuid(),id,date_trunc('week',coalesce("openedDate",(now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date))::date,"meetingDay","meetingTime",'system:migration-005' FROM cells;
CREATE TRIGGER cell_schedules_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON cell_schedules FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
CREATE TABLE cell_meetings (
 id uuid PRIMARY KEY, "cellId" uuid NOT NULL REFERENCES cells(id), week date NOT NULL, date date NOT NULL,
 time text NOT NULL CHECK(time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'), "scheduleId" uuid NOT NULL REFERENCES cell_schedules(id),
 status text NOT NULL DEFAULT 'SCHEDULED' CHECK(status IN ('SCHEDULED','OPEN','RECORDED','CLOSED','CANCELLED')),
 notes varchar(2000), "cancellationReason" varchar(1000), "snapshotAt" timestamptz, "loadedAt" timestamptz,
 "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
 "createdBy" text NOT NULL, "updatedBy" text NOT NULL, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE("cellId",week), CHECK(extract(isodow FROM week)=1), CHECK(date>=week AND date<week+7),
 CHECK(status<>'CANCELLED' OR ("cancellationReason" IS NOT NULL AND length(trim("cancellationReason"))>0)),
 CHECK(status NOT IN ('OPEN','RECORDED','CLOSED') OR "snapshotAt" IS NOT NULL),
 CHECK(status NOT IN ('RECORDED','CLOSED') OR "loadedAt" IS NOT NULL)
);
CREATE INDEX meetings_weekly ON cell_meetings(week,"cellId",date,id);
CREATE INDEX meetings_cell_history ON cell_meetings("cellId",date DESC,id);
CREATE TABLE attendance_states (key text PRIMARY KEY);
INSERT INTO attendance_states VALUES ('PRESENT'),('ABSENT');
CREATE TABLE meeting_attendance (
 "meetingId" uuid NOT NULL REFERENCES cell_meetings(id), "personId" uuid NOT NULL REFERENCES people(id),
 "membershipId" uuid NOT NULL REFERENCES cell_memberships(id), role text NOT NULL,
 "startDate" date NOT NULL, "endDate" date, status text REFERENCES attendance_states(key), notes varchar(500),
 "updatedAt" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY("meetingId","personId")
);
CREATE INDEX attendance_person_history ON meeting_attendance("personId","meetingId") INCLUDE(status);
CREATE INDEX membership_temporal ON cell_memberships("cellId","startDate","endDate","personId");
CREATE TABLE meeting_events (
 id uuid PRIMARY KEY, sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 "meetingId" uuid NOT NULL REFERENCES cell_meetings(id), action text NOT NULL, "actorId" text NOT NULL,
 reason varchar(1000), changes jsonb NOT NULL DEFAULT '[]', "occurredAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meeting_events_history ON meeting_events("meetingId",sequence DESC);
CREATE TRIGGER meeting_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON meeting_events FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
CREATE TRIGGER meetings_no_delete BEFORE DELETE OR TRUNCATE ON cell_meetings FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
CREATE TRIGGER attendance_no_delete BEFORE DELETE OR TRUNCATE ON meeting_attendance FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
CREATE FUNCTION protect_attendance_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s text;
BEGIN
 SELECT status INTO s FROM cell_meetings WHERE id=NEW."meetingId" FOR UPDATE;
 IF TG_OP='INSERT' AND s<>'SCHEDULED' THEN RAISE EXCEPTION 'Snapshot already captured' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' AND NOT EXISTS(SELECT 1 FROM cell_memberships cm JOIN cell_meetings m ON m.id=NEW."meetingId" WHERE cm.id=NEW."membershipId" AND cm."personId"=NEW."personId" AND cm."cellId"=m."cellId" AND cm.role=NEW.role AND cm."startDate"=NEW."startDate" AND cm."endDate" IS NOT DISTINCT FROM NEW."endDate" AND cm."startDate"<=m.date AND (cm."endDate" IS NULL OR cm."endDate">m.date)) THEN RAISE EXCEPTION 'Snapshot membership does not match meeting date' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (s NOT IN ('OPEN','RECORDED') OR NEW."meetingId"<>OLD."meetingId" OR NEW."personId"<>OLD."personId" OR NEW."membershipId"<>OLD."membershipId" OR NEW.role<>OLD.role OR NEW."startDate"<>OLD."startDate" OR NEW."endDate" IS DISTINCT FROM OLD."endDate") THEN RAISE EXCEPTION 'Snapshot is immutable or meeting is locked' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER attendance_snapshot BEFORE INSERT OR UPDATE ON meeting_attendance FOR EACH ROW EXECUTE FUNCTION protect_attendance_snapshot();
CREATE FUNCTION protect_meeting_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id<>OLD.id OR NEW."cellId"<>OLD."cellId" OR NEW.week<>OLD.week OR NEW."createdAt"<>OLD."createdAt" OR NEW."createdBy"<>OLD."createdBy" THEN RAISE EXCEPTION 'Meeting identity is immutable' USING ERRCODE='23514'; END IF;
 IF OLD.status<>'SCHEDULED' AND (NEW.date<>OLD.date OR NEW.time<>OLD.time OR NEW."scheduleId"<>OLD."scheduleId") THEN RAISE EXCEPTION 'Historical schedule is immutable' USING ERRCODE='23514'; END IF;
 IF OLD."snapshotAt" IS NOT NULL AND NEW."snapshotAt" IS DISTINCT FROM OLD."snapshotAt" THEN RAISE EXCEPTION 'Snapshot time is immutable' USING ERRCODE='23514'; END IF;
 IF NOT ((OLD.status='SCHEDULED' AND NEW.status IN ('SCHEDULED','OPEN','CANCELLED')) OR (OLD.status='OPEN' AND NEW.status IN ('RECORDED','CANCELLED')) OR (OLD.status='RECORDED' AND NEW.status IN ('RECORDED','CLOSED','CANCELLED')) OR (OLD.status='CLOSED' AND NEW.status='RECORDED')) THEN RAISE EXCEPTION 'Invalid meeting transition' USING ERRCODE='23514'; END IF;
 IF OLD.status='CLOSED' AND NEW.notes IS DISTINCT FROM OLD.notes THEN RAISE EXCEPTION 'Reopen before editing' USING ERRCODE='23514'; END IF;
 IF NEW.status IN ('RECORDED','CLOSED') AND EXISTS(SELECT 1 FROM meeting_attendance WHERE "meetingId"=NEW.id AND status IS NULL) THEN RAISE EXCEPTION 'Attendance is incomplete' USING ERRCODE='23514'; END IF;
 IF NEW.status='CANCELLED' AND EXISTS(SELECT 1 FROM meeting_attendance WHERE "meetingId"=NEW.id AND status IS NOT NULL) THEN RAISE EXCEPTION 'Cancelled meeting cannot produce absences' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER meeting_state_rules BEFORE UPDATE ON cell_meetings FOR EACH ROW EXECUTE FUNCTION protect_meeting_state();
INSERT INTO permissions(key) VALUES ('asistencia.ver'),('asistencia.generar'),('asistencia.cargar'),('asistencia.editar'),('asistencia.cerrar'),('asistencia.cancelar'),('asistencia.reabrir');
INSERT INTO role_permissions(role_id,permission) SELECT r.id,p.key FROM roles r CROSS JOIN permissions p WHERE r.name='Oficina administrativa' AND p.key LIKE 'asistencia.%';
