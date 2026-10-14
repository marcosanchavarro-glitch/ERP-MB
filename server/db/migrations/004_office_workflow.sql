-- Canonical Person values are distinct from the F/M Cell suffix.
ALTER TABLE people DROP CONSTRAINT people_sex_check;
INSERT INTO audit_events(id,actor_id,action,entity,entity_id,changes,context)
 SELECT gen_random_uuid(),'system:migration-004','PERSON_SEX_NORMALIZE','PERSON',id,
 jsonb_build_array(jsonb_build_object('field','sex','before',sex,'after',CASE sex WHEN 'MASCULINO' THEN 'HOMBRE' WHEN 'FEMENINO' THEN 'MUJER' ELSE NULL END)),
 '{"migration":"004_office_workflow"}'::jsonb FROM people WHERE sex IS NOT NULL AND sex NOT IN ('HOMBRE','MUJER');
UPDATE people SET sex=CASE sex WHEN 'MASCULINO' THEN 'HOMBRE' WHEN 'FEMENINO' THEN 'MUJER' ELSE NULL END,version=version+1,"updatedAt"=now() WHERE sex IS NOT NULL AND sex NOT IN ('HOMBRE','MUJER');
ALTER TABLE people ADD CONSTRAINT people_sex_check CHECK(sex IS NULL OR sex IN ('HOMBRE','MUJER'));
-- Unknown opening dates must stay unknown; operational movement dates remain required.
ALTER TABLE cells ALTER COLUMN "openedDate" DROP NOT NULL;
ALTER TABLE cells ALTER COLUMN "lastEffectiveDate" DROP NOT NULL;
ALTER TABLE cell_events ALTER COLUMN "effectiveDate" DROP NOT NULL;
ALTER TABLE cell_operations DROP CONSTRAINT cell_operations_kind_check;
ALTER TABLE cell_operations ADD CONSTRAINT cell_operations_kind_check CHECK(kind IN ('ASSIGN','BATCH_ASSIGN','END','ROLE','TRANSFER','CLOSE','ABSORB','REDISTRIBUTE'));
