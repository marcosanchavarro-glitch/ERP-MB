CREATE TABLE followup_metrics (
 person_id uuid PRIMARY KEY REFERENCES people(id), streak integer NOT NULL, last8 integer NOT NULL,
 valid_count integer NOT NULL, level text NOT NULL CHECK(level IN ('REGULAR','ATTENTION','URGENT')),
 last_present date, last_valid date, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX followup_metrics_priority ON followup_metrics(level,streak DESC,person_id);
CREATE TABLE followup_alerts (
 id uuid PRIMARY KEY, person_id uuid NOT NULL REFERENCES people(id), episode_key uuid NOT NULL REFERENCES cell_meetings(id),
 cell_id uuid NOT NULL REFERENCES cells(id), level text NOT NULL CHECK(level IN ('ATTENTION','URGENT')),
 status text NOT NULL CHECK(status IN ('ACTIVE','RESOLVED')), reached_date date NOT NULL,
 streak integer NOT NULL, meeting_ids uuid[] NOT NULL, resolution text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(person_id,episode_key)
);
CREATE INDEX followup_alert_person ON followup_alerts(person_id,created_at DESC);
CREATE TABLE followup_cases (
 id uuid PRIMARY KEY, person_id uuid NOT NULL REFERENCES people(id), cell_id uuid REFERENCES cells(id),
 alert_id uuid REFERENCES followup_alerts(id), origin text NOT NULL CHECK(origin IN ('AUTOMATIC','MANUAL')),
 reason text NOT NULL, level text NOT NULL CHECK(level IN ('ATTENTION','URGENT')),
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','FOLLOWING','REGULARIZED','CLOSED')),
 responsible_id uuid REFERENCES people(id), notes varchar(4000), opened_at timestamptz NOT NULL DEFAULT now(),
 last_action_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz, close_result varchar(2000),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX followup_one_active ON followup_cases(person_id) WHERE status IN ('OPEN','FOLLOWING');
CREATE UNIQUE INDEX followup_case_episode ON followup_cases(alert_id) WHERE alert_id IS NOT NULL;
CREATE INDEX followup_cases_person ON followup_cases(person_id,opened_at DESC);
CREATE INDEX followup_cases_responsible ON followup_cases(responsible_id,status);
ALTER TABLE followup_alerts ADD COLUMN case_id uuid REFERENCES followup_cases(id);
CREATE TABLE followup_interventions (
 id uuid PRIMARY KEY, case_id uuid NOT NULL REFERENCES followup_cases(id), date date NOT NULL,
 responsible_id uuid NOT NULL REFERENCES people(id), type text NOT NULL CHECK(type IN ('CALL','MESSAGE','CONVERSATION','VISIT','OTHER')),
 note varchar(2000) NOT NULL, result varchar(2000), actor_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX followup_interventions_case ON followup_interventions(case_id,created_at DESC);
CREATE TABLE followup_events (
 id uuid PRIMARY KEY, sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE, person_id uuid NOT NULL REFERENCES people(id),
 case_id uuid REFERENCES followup_cases(id), alert_id uuid REFERENCES followup_alerts(id), action text NOT NULL,
 actor_id text NOT NULL, origin text NOT NULL CHECK(origin IN ('AUTOMATIC','HUMAN')), data jsonb NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX followup_events_person ON followup_events(person_id,sequence DESC);
CREATE TRIGGER followup_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON followup_events FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
CREATE TRIGGER followup_interventions_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON followup_interventions FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
CREATE TRIGGER followup_alerts_no_delete BEFORE DELETE OR TRUNCATE ON followup_alerts FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
CREATE TRIGGER followup_cases_no_delete BEFORE DELETE OR TRUNCATE ON followup_cases FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
-- Transaction-local invalidation set. The application drains it before COMMIT.
CREATE TABLE followup_dirty (transaction_id bigint NOT NULL,person_id uuid NOT NULL REFERENCES people(id),PRIMARY KEY(transaction_id,person_id));
CREATE FUNCTION mark_followup_dirty() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='cell_meetings' THEN
  INSERT INTO followup_dirty SELECT txid_current(),"personId" FROM meeting_attendance WHERE "meetingId"=NEW.id ON CONFLICT DO NOTHING;
 ELSE
  INSERT INTO followup_dirty VALUES(txid_current(),NEW."personId") ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER followup_attendance_changed AFTER INSERT OR UPDATE ON meeting_attendance FOR EACH ROW EXECUTE FUNCTION mark_followup_dirty();
CREATE TRIGGER followup_meeting_changed AFTER UPDATE ON cell_meetings FOR EACH ROW EXECUTE FUNCTION mark_followup_dirty();
CREATE TRIGGER followup_membership_changed AFTER INSERT OR UPDATE ON cell_memberships FOR EACH ROW EXECUTE FUNCTION mark_followup_dirty();
INSERT INTO permissions(key) VALUES ('seguimiento.ver'),('seguimiento.gestionar'),('lider.indicadores');
INSERT INTO role_permissions(role_id,permission) SELECT r.id,p.key FROM roles r CROSS JOIN permissions p WHERE r.name='Oficina administrativa' AND p.key LIKE 'seguimiento.%';
INSERT INTO role_permissions(role_id,permission) SELECT id,'lider.indicadores' FROM roles WHERE name='Portal líder';
