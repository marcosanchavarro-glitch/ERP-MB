-- Read-only derived tools. No persisted age, birthday, score or quality flags.
INSERT INTO permissions(key) VALUES ('personas.cumpleanos'),('personas.calidad'),('celulas.calidad');
-- Preserve access for the legacy Office profile without granting leaders general access.
INSERT INTO role_permissions(role_id,permission)
 SELECT r.id,p.key FROM roles r CROSS JOIN permissions p
 WHERE r.name='Oficina administrativa' AND p.key IN ('personas.cumpleanos','personas.calidad','celulas.calidad')
 ON CONFLICT DO NOTHING;
