ALTER TABLE users ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0);
ALTER TABLE users ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE user_permissions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), permission text NOT NULL REFERENCES permissions(key),
 scope_type text NOT NULL CHECK(scope_type IN ('global','person','cell','area','subarea')),scope_id text,
 CHECK((scope_type='global')=(scope_id IS NULL)), UNIQUE NULLS NOT DISTINCT(user_id,permission,scope_type,scope_id)
);
CREATE INDEX user_permissions_user ON user_permissions(user_id);
CREATE INDEX users_person_search ON users(person_id);
INSERT INTO permissions(key) VALUES ('admin.usuarios.ver'),('admin.usuarios.gestionar'),('admin.auditoria.ver'),('modulos.acceder');
INSERT INTO roles(id,name) VALUES(gen_random_uuid(),'Administrador General'),(gen_random_uuid(),'Apóstol'),(gen_random_uuid(),'Oficinista'),(gen_random_uuid(),'Usuario por áreas') ON CONFLICT(name) DO NOTHING;
INSERT INTO role_permissions(role_id,permission) SELECT r.id,p.key FROM roles r CROSS JOIN permissions p WHERE r.name IN ('Administrador General','Apóstol') AND p.key NOT LIKE 'lider.%' ON CONFLICT DO NOTHING;
INSERT INTO role_permissions(role_id,permission) SELECT r.id,p.key FROM roles r CROSS JOIN permissions p WHERE r.name='Oficinista' AND (p.key LIKE 'personas.%' OR p.key LIKE 'celulas.%' OR p.key LIKE 'asistencia.%' OR p.key LIKE 'seguimiento.%') ON CONFLICT DO NOTHING;
-- The sole legacy CLI administrator is retained as the bootstrap administrator.
-- Ambiguous installations require explicit offline bootstrap; never promote all office staff.
INSERT INTO user_roles(id,user_id,role_id,scope_type)
 SELECT gen_random_uuid(),u.id,r.id,'global' FROM users u CROSS JOIN roles r
 WHERE r.name='Administrador General' AND u.active AND u.id IN
 (SELECT ur.user_id FROM user_roles ur JOIN roles old ON old.id=ur.role_id WHERE old.name='Oficina administrativa' AND ur.scope_type='global')
 AND (SELECT count(DISTINCT ur.user_id) FROM user_roles ur JOIN roles old ON old.id=ur.role_id JOIN users x ON x.id=ur.user_id WHERE old.name='Oficina administrativa' AND ur.scope_type='global' AND x.active)=1
 ON CONFLICT DO NOTHING;
INSERT INTO audit_events(id,actor_id,action,entity,entity_id,changes,context)
 SELECT gen_random_uuid(),'system:migration-008','USER_ADMIN_BOOTSTRAP','USER',ur.user_id,
 '[{"field":"profile","before":"Oficina administrativa (CLI)","after":"Administrador General"}]'::jsonb,'{}'::jsonb
 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE r.name='Administrador General';
CREATE VIEW identity_audit AS SELECT id,sequence,actor_id,action,entity_id,occurred_at,changes,context FROM audit_events WHERE entity='USER';
-- Preserve semantic profiles as future functional permissions are introduced.
CREATE FUNCTION grant_system_profile_permission() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO role_permissions(role_id,permission)
 SELECT id,NEW.key FROM roles WHERE
 (name IN ('Administrador General','Apóstol') AND NEW.key NOT LIKE 'lider.%')
 OR (name='Oficinista' AND (NEW.key LIKE 'personas.%' OR NEW.key LIKE 'celulas.%' OR NEW.key LIKE 'asistencia.%' OR NEW.key LIKE 'seguimiento.%'))
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END; $$;
CREATE TRIGGER system_profile_new_permission AFTER INSERT ON permissions FOR EACH ROW EXECUTE FUNCTION grant_system_profile_permission();
