CREATE TABLE office_worker_settings (
 user_id uuid PRIMARY KEY REFERENCES users(id), active boolean NOT NULL DEFAULT false,
 sexes text[] NOT NULL DEFAULT '{}', daily_goal integer NOT NULL DEFAULT 6 CHECK(daily_goal BETWEEN 1 AND 100),
 cooldown_minutes integer NOT NULL DEFAULT 60 CHECK(cooldown_minutes BETWEEN 1 AND 10080),
 claim_minutes integer NOT NULL DEFAULT 15 CHECK(claim_minutes BETWEEN 1 AND 120),
 version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(sexes <@ ARRAY['HOMBRE','MUJER']::text[]), CHECK(NOT active OR cardinality(sexes)>0)
);
CREATE TABLE office_contact_claims (
 person_id uuid PRIMARY KEY REFERENCES people(id), user_id uuid NOT NULL UNIQUE REFERENCES users(id),
 id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL, expires_at timestamptz NOT NULL
);
CREATE INDEX office_claim_expiration ON office_contact_claims(expires_at);
CREATE TABLE office_contacts (
 id uuid PRIMARY KEY, person_id uuid NOT NULL REFERENCES people(id), worker_id uuid NOT NULL REFERENCES users(id),
 occurred_at timestamptz NOT NULL, type text NOT NULL CHECK(type IN ('CALL','MESSAGE','CONVERSATION','VISIT','OTHER')),
 result text NOT NULL CHECK(result IN ('CONTACTO_ESTABLECIDO','NO_CONTESTO','VOLVER_A_LLAMAR','NUMERO_INCORRECTO','OTRO')),
 origin text NOT NULL CHECK(origin IN ('CONTACTO_MENSUAL','INASISTENCIA','SEGUIMIENTO','OTRO')),
 case_id uuid REFERENCES followup_cases(id), note varchar(2000), next_eligible_at timestamptz,
 phone_key text NOT NULL, request_digest text NOT NULL, version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX office_contact_person ON office_contacts(person_id,occurred_at DESC,id);
CREATE INDEX office_contact_worker ON office_contacts(worker_id,occurred_at);
CREATE INDEX office_contact_effective ON office_contacts(person_id,occurred_at DESC) WHERE result='CONTACTO_ESTABLECIDO';
CREATE INDEX office_contact_case ON office_contacts(case_id,occurred_at DESC);
CREATE TABLE office_contact_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contact_id uuid NOT NULL REFERENCES office_contacts(id), actor_id uuid NOT NULL REFERENCES users(id),
 occurred_at timestamptz NOT NULL DEFAULT now(), reason varchar(500) NOT NULL, before_data jsonb NOT NULL, after_data jsonb NOT NULL
);
CREATE TRIGGER office_contact_revisions_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON office_contact_revisions FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
CREATE TRIGGER office_contacts_no_delete BEFORE DELETE OR TRUNCATE ON office_contacts FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
-- Shared temporal eligibility: live memberships before opening, captured participants afterwards.
CREATE VIEW meeting_participation AS
 SELECT a."personId" person_id,m.id meeting_id,m."cellId" cell_id,m.date,m.time,m.status meeting_status,a.status attendance_status
 FROM cell_meetings m JOIN meeting_attendance a ON a."meetingId"=m.id WHERE m."snapshotAt" IS NOT NULL
 UNION ALL
 SELECT cm."personId",m.id,m."cellId",m.date,m.time,m.status,NULL
 FROM cell_meetings m JOIN cell_memberships cm ON cm."cellId"=m."cellId" AND cm."startDate"<=m.date AND (cm."endDate" IS NULL OR cm."endDate">m.date)
 WHERE m."snapshotAt" IS NULL;
INSERT INTO permissions(key) VALUES ('oficina.trabajar'),('oficina.contactos.ver'),('oficina.contactos.registrar'),('oficina.contactos.corregir'),('oficina.panorama'),('oficina.configurar');
INSERT INTO role_permissions(role_id,permission) SELECT r.id,p.key FROM roles r CROSS JOIN permissions p
 WHERE r.name IN ('Oficinista','Oficina administrativa') AND p.key IN ('oficina.trabajar','oficina.contactos.ver','oficina.contactos.registrar','oficina.contactos.corregir') ON CONFLICT DO NOTHING;
