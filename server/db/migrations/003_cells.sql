CREATE TABLE cells (
 id uuid PRIMARY KEY, "groupCode" text NOT NULL CHECK("groupCode" ~ '^[A-Z]$'),
 generation integer NOT NULL CHECK(generation BETWEEN 1 AND 9999), gender text NOT NULL CHECK(gender IN ('F','M')),
 "displayCode" text GENERATED ALWAYS AS ("groupCode" || generation::text || ' ' || gender) STORED,
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','CLOSED')),
 "openedDate" date NOT NULL, "closedDate" date, "lastEffectiveDate" date NOT NULL,
 "meetingDay" text CHECK("meetingDay" IN ('0','1','2','3','4','5','6')),
 "meetingTime" text CHECK("meetingTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 address varchar(200), locality varchar(100), municipality varchar(100), province varchar(100), reference varchar(300), notes varchar(4000),
 "originCellId" uuid REFERENCES cells(id), latitude double precision, longitude double precision,
 "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1 CHECK(version>0),
 CHECK((status='CLOSED')=("closedDate" IS NOT NULL)), CHECK("closedDate">="openedDate"), CHECK("lastEffectiveDate">="openedDate"), CHECK("originCellId"<>id)
);
CREATE UNIQUE INDEX cells_active_code ON cells("groupCode",generation,gender) WHERE status='ACTIVE';
CREATE INDEX cells_listing ON cells(status,"groupCode",generation,gender,id);
CREATE INDEX cells_day ON cells("meetingDay",status);
CREATE INDEX cells_locality ON cells(lower(locality));
CREATE INDEX cells_code_search ON cells USING gin("displayCode" gin_trgm_ops);
CREATE TABLE cell_operations (
 id uuid PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('ASSIGN','END','ROLE','TRANSFER','CLOSE','ABSORB','REDISTRIBUTE')),
 "sourceCellId" uuid NOT NULL REFERENCES cells(id), "destinationCellId" uuid REFERENCES cells(id),
 "effectiveDate" date NOT NULL, reason varchar(1000), "actorId" text NOT NULL, "occurredAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cell_memberships (
 id uuid PRIMARY KEY, sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 "cellId" uuid NOT NULL REFERENCES cells(id), "personId" uuid NOT NULL REFERENCES people(id),
 role text NOT NULL CHECK(role IN ('LEADER','ASSISTANT','MEMBER')),
 "startDate" date NOT NULL, "endDate" date, "startOperationId" uuid NOT NULL REFERENCES cell_operations(id), "endOperationId" uuid REFERENCES cell_operations(id),
 CHECK("endDate">="startDate"), CHECK(("endDate" IS NULL)=("endOperationId" IS NULL))
);
CREATE UNIQUE INDEX cell_one_active_person ON cell_memberships("personId") WHERE "endDate" IS NULL;
CREATE INDEX cell_members_current ON cell_memberships("cellId",role,"personId") WHERE "endDate" IS NULL;
CREATE INDEX cell_person_history ON cell_memberships("personId","startDate" DESC,sequence DESC);
CREATE UNIQUE INDEX cell_members_operation ON cell_memberships("startOperationId","personId");
CREATE INDEX cell_members_history ON cell_memberships("cellId","startDate" DESC,id);
CREATE TABLE cell_events (
 id uuid PRIMARY KEY, sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 "cellId" uuid NOT NULL REFERENCES cells(id), "personId" uuid REFERENCES people(id), "operationId" uuid REFERENCES cell_operations(id),
 summary text NOT NULL, "effectiveDate" date NOT NULL, "occurredAt" timestamptz NOT NULL DEFAULT now(), "actorId" text NOT NULL
);
CREATE INDEX cell_events_timeline ON cell_events("cellId",sequence DESC);
-- Service holds ordered cell row locks before all membership changes. This trigger also
-- checks direct writes, serializing inserts against the parent cell.
CREATE FUNCTION check_cell_membership() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s text; opened date; n integer;
BEGIN
 IF TG_OP='UPDATE' AND (OLD."endDate" IS NOT NULL OR NEW.sequence<>OLD.sequence OR NEW."cellId"<>OLD."cellId" OR NEW."personId"<>OLD."personId" OR NEW.role<>OLD.role OR NEW."startDate"<>OLD."startDate" OR NEW."startOperationId"<>OLD."startOperationId" OR NEW.id<>OLD.id OR NEW."endDate" IS NULL) THEN
 RAISE EXCEPTION 'Membership history cannot be rewritten' USING ERRCODE='23514'; END IF;
 SELECT status,"openedDate" INTO s,opened FROM cells WHERE id=NEW."cellId" FOR UPDATE;
 IF NEW."startDate"<opened THEN RAISE EXCEPTION 'Membership precedes opening' USING ERRCODE='23514'; END IF;
 IF NEW."endDate" IS NULL THEN
  IF s<>'ACTIVE' THEN RAISE EXCEPTION 'Cell is closed' USING ERRCODE='23514'; END IF;
  SELECT count(*) INTO n FROM cell_memberships WHERE "cellId"=NEW."cellId" AND "endDate" IS NULL AND role=NEW.role AND id<>NEW.id;
  IF (NEW.role='LEADER' AND n>=2) OR (NEW.role='ASSISTANT' AND n>=3) THEN RAISE EXCEPTION 'Role capacity exceeded' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cell_membership_rules BEFORE INSERT OR UPDATE ON cell_memberships FOR EACH ROW EXECUTE FUNCTION check_cell_membership();
CREATE TRIGGER cell_membership_no_delete BEFORE DELETE OR TRUNCATE ON cell_memberships FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
CREATE TRIGGER cell_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON cell_events FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
CREATE TRIGGER cell_operations_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON cell_operations FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
INSERT INTO permissions(key) VALUES ('celulas.ver'),('celulas.crear'),('celulas.editar'),('celulas.gestionar_integrantes'),('celulas.transferir'),('celulas.cerrar');
INSERT INTO role_permissions(role_id,permission) SELECT r.id,p.key FROM roles r CROSS JOIN permissions p WHERE r.name='Oficina administrativa' AND p.key LIKE 'celulas.%';
CREATE FUNCTION check_cell_closure() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='CLOSED' THEN RAISE EXCEPTION 'Closed cells cannot be rewritten' USING ERRCODE='23514'; END IF;
 IF NEW.status='CLOSED' AND EXISTS(SELECT 1 FROM cell_memberships WHERE "cellId"=NEW.id AND "endDate" IS NULL) THEN RAISE EXCEPTION 'Active memberships prevent closure' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER cell_closure_rules BEFORE UPDATE ON cells FOR EACH ROW EXECUTE FUNCTION check_cell_closure();
CREATE TRIGGER cells_no_delete BEFORE DELETE OR TRUNCATE ON cells FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
