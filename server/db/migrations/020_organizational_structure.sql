CREATE TABLE organizational_units (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), catalog_key text UNIQUE,
 name varchar(100) NOT NULL CHECK(length(trim(name))>0), description varchar(1000),
 parent_id uuid REFERENCES organizational_units(id) ON DELETE RESTRICT, active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 created_by text NOT NULL,updated_by text NOT NULL, CHECK(parent_id IS DISTINCT FROM id)
);
CREATE UNIQUE INDEX organizational_units_name ON organizational_units(coalesce(parent_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(trim(name)));
CREATE INDEX organizational_units_parent ON organizational_units(parent_id);
-- Names and the Multimedia hierarchy verified against the existing project catalog.
-- These records do not grant module access and have no person assignments.
INSERT INTO organizational_units(catalog_key,name,created_by,updated_by) VALUES
 ('hdr','HDR','system:catalog-020','system:catalog-020'),('musica-sonido','Música y Sonido','system:catalog-020','system:catalog-020'),('multimedia','Multimedia','system:catalog-020','system:catalog-020'),('recepcion','Recepción','system:catalog-020','system:catalog-020'),('hdr-arte','HDR Arte','system:catalog-020','system:catalog-020'),('limpieza','Limpieza','system:catalog-020','system:catalog-020'),('oficina','Oficina Manantial','system:catalog-020','system:catalog-020'),('comedor','Comedor','system:catalog-020','system:catalog-020');
INSERT INTO organizational_units(catalog_key,name,parent_id,created_by,updated_by) SELECT c.key,c.name,u.id,'system:catalog-020','system:catalog-020' FROM organizational_units u CROSS JOIN(VALUES('multimedia-pantalla','Pantalla'),('multimedia-transmision','Transmisión'),('multimedia-fotografia','Fotografía'),('multimedia-redes','Redes'),('multimedia-diseno','Diseño')) c(key,name) WHERE u.catalog_key='multimedia';
CREATE FUNCTION organizational_unit_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(404020);
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Organizational units are not deleted'; END IF;
 IF NEW.parent_id IS NOT NULL AND (NEW.parent_id=NEW.id OR EXISTS(WITH RECURSIVE descendants AS(SELECT id FROM organizational_units WHERE parent_id=NEW.id UNION ALL SELECT u.id FROM organizational_units u JOIN descendants d ON u.parent_id=d.id) SELECT 1 FROM descendants WHERE id=NEW.parent_id)) THEN RAISE EXCEPTION 'Organizational cycle' USING ERRCODE='23514';END IF;
 IF NEW.active AND NEW.parent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM organizational_units WHERE id=NEW.parent_id AND active) THEN RAISE EXCEPTION 'Inactive parent' USING ERRCODE='23514';END IF;
 IF NOT NEW.active AND EXISTS(SELECT 1 FROM organizational_units WHERE parent_id=NEW.id AND active) THEN RAISE EXCEPTION 'Deactivate subareas first' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER organizational_unit_guard BEFORE INSERT OR UPDATE OR DELETE ON organizational_units FOR EACH ROW EXECUTE FUNCTION organizational_unit_guard();
CREATE TRIGGER organizational_units_no_truncate BEFORE TRUNCATE ON organizational_units FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
CREATE TABLE organizational_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),person_id uuid NOT NULL REFERENCES people(id),unit_id uuid NOT NULL REFERENCES organizational_units(id),
 responsibility varchar(80) NOT NULL,responsibility_key text NOT NULL,is_responsible boolean NOT NULL DEFAULT false,
 start_date text NOT NULL,end_date text,notes varchar(1000),created_by text NOT NULL,ended_by text,
 created_at timestamptz NOT NULL DEFAULT now(),ended_at timestamptz,version integer NOT NULL DEFAULT 1,
 CHECK(start_date ~ '^\d{4}-\d{2}-\d{2}$' AND (end_date IS NULL OR(end_date ~ '^\d{4}-\d{2}-\d{2}$' AND end_date>=start_date)))
);
CREATE UNIQUE INDEX organizational_assignment_current ON organizational_assignments(person_id,unit_id,responsibility_key) WHERE end_date IS NULL;
CREATE INDEX organizational_assignments_unit ON organizational_assignments(unit_id,end_date);
CREATE INDEX organizational_assignments_person ON organizational_assignments(person_id,start_date DESC);
CREATE FUNCTION organizational_assignment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(404020);
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Assignments retain history'; END IF;
 IF TG_OP='INSERT' AND NOT EXISTS(SELECT 1 FROM organizational_units WHERE id=NEW.unit_id AND active) THEN RAISE EXCEPTION 'Inactive organizational unit' USING ERRCODE='23514';END IF;
 IF TG_OP='UPDATE' AND (OLD.end_date IS NOT NULL OR NEW.end_date IS NULL OR (to_jsonb(NEW)-ARRAY['end_date','ended_by','ended_at','version']) IS DISTINCT FROM(to_jsonb(OLD)-ARRAY['end_date','ended_by','ended_at','version'])) THEN RAISE EXCEPTION 'Historical assignments are immutable';END IF;
 IF EXISTS(SELECT 1 FROM organizational_assignments a WHERE a.person_id=NEW.person_id AND a.unit_id=NEW.unit_id AND a.responsibility_key=NEW.responsibility_key AND a.id<>NEW.id AND daterange(a.start_date::date,a.end_date::date,'[)') && daterange(NEW.start_date::date,NEW.end_date::date,'[)')) THEN RAISE EXCEPTION 'Overlapping identical assignment' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER organizational_assignment_guard BEFORE INSERT OR UPDATE OR DELETE ON organizational_assignments FOR EACH ROW EXECUTE FUNCTION organizational_assignment_guard();
CREATE TRIGGER organizational_assignments_no_truncate BEFORE TRUNCATE ON organizational_assignments FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
CREATE TABLE organizational_events (
 sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,entity_id uuid NOT NULL,person_id uuid REFERENCES people(id),action text NOT NULL,
 actor_id text NOT NULL,occurred_at timestamptz NOT NULL DEFAULT now(),before_value jsonb,after_value jsonb,
 operation_id uuid NOT NULL UNIQUE,fingerprint text NOT NULL,result jsonb NOT NULL
);
CREATE INDEX organizational_events_person ON organizational_events(person_id,sequence DESC);
CREATE INDEX organizational_events_entity ON organizational_events(entity_id,sequence DESC);
CREATE TRIGGER organizational_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON organizational_events FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
