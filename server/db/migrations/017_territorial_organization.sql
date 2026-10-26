CREATE TABLE territory_units (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 level text NOT NULL CHECK(level IN ('COUNTRY','PROVINCE','MUNICIPALITY','LOCALITY','ZONE','SECTOR')),
 parent_id uuid REFERENCES territory_units(id) ON DELETE RESTRICT,
 name varchar(100) NOT NULL CHECK(length(trim(name))>0), description varchar(1000),
 active boolean NOT NULL DEFAULT true,
 survey_status text NOT NULL DEFAULT 'PENDING' CHECK(survey_status IN ('PENDING','REVIEWED')),
 version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid NOT NULL REFERENCES users(id)
);
CREATE UNIQUE INDEX territory_units_name ON territory_units(coalesce(parent_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(trim(name)));
CREATE INDEX territory_units_parent ON territory_units(parent_id);
CREATE FUNCTION territory_unit_hierarchy() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected text; parent_level text; parent_active boolean;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.level IS DISTINCT FROM OLD.level OR NEW.parent_id IS DISTINCT FROM OLD.parent_id) THEN
 RAISE EXCEPTION 'Territorial hierarchy cannot be moved implicitly' USING ERRCODE='23514'; END IF;
 expected:=CASE NEW.level WHEN 'PROVINCE' THEN 'COUNTRY' WHEN 'MUNICIPALITY' THEN 'PROVINCE' WHEN 'LOCALITY' THEN 'MUNICIPALITY' WHEN 'ZONE' THEN 'LOCALITY' WHEN 'SECTOR' THEN 'ZONE' END;
 IF expected IS NULL THEN
 IF NEW.parent_id IS NOT NULL THEN RAISE EXCEPTION 'Country requires no parent' USING ERRCODE='23514'; END IF;
 ELSE
 SELECT level,active INTO parent_level,parent_active FROM territory_units WHERE id=NEW.parent_id;
 IF parent_level IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Invalid territorial parent' USING ERRCODE='23514'; END IF;
 IF NEW.active AND NOT coalesce(parent_active,false) THEN RAISE EXCEPTION 'Inactive territorial parent' USING ERRCODE='23514'; END IF;
 END IF;
 IF NOT NEW.active AND EXISTS(SELECT 1 FROM territory_units WHERE parent_id=NEW.id AND active) THEN
 RAISE EXCEPTION 'Deactivate children first' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER territory_units_hierarchy BEFORE INSERT OR UPDATE ON territory_units FOR EACH ROW EXECUTE FUNCTION territory_unit_hierarchy();
CREATE TABLE cell_territory (
 cell_id uuid PRIMARY KEY REFERENCES cells(id) ON DELETE RESTRICT,
 unit_id uuid REFERENCES territory_units(id) ON DELETE RESTRICT,
 version integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid NOT NULL REFERENCES users(id)
);
CREATE INDEX cell_territory_unit ON cell_territory(unit_id);
-- No geographic names, boundaries or assignments are seeded or inferred.
