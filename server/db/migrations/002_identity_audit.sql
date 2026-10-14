CREATE TABLE users (
 id uuid PRIMARY KEY, username varchar(100) NOT NULL UNIQUE CHECK(username=lower(username)),
 password_hash text NOT NULL, active boolean NOT NULL DEFAULT true,
 person_id uuid UNIQUE REFERENCES people(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE roles (id uuid PRIMARY KEY, name text NOT NULL UNIQUE);
CREATE TABLE permissions (key text PRIMARY KEY);
CREATE TABLE role_permissions (role_id uuid NOT NULL REFERENCES roles(id), permission text NOT NULL REFERENCES permissions(key), PRIMARY KEY(role_id,permission));
CREATE TABLE user_roles (
 id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id),role_id uuid NOT NULL REFERENCES roles(id),
 scope_type text NOT NULL CHECK(scope_type IN ('global','person','cell','area','subarea')),
 scope_id uuid, CHECK((scope_type='global')=(scope_id IS NULL)),
 UNIQUE NULLS NOT DISTINCT(user_id,role_id,scope_type,scope_id)
);
CREATE INDEX user_roles_user ON user_roles(user_id);
INSERT INTO permissions(key) VALUES ('personas.ver'),('personas.crear'),('personas.editar'),('personas.historial');
CREATE TABLE sessions (sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL);
CREATE INDEX sessions_expire ON sessions(expire);
CREATE TABLE audit_events (
 id uuid PRIMARY KEY, sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 actor_id text NOT NULL, action text NOT NULL, entity text NOT NULL, entity_id uuid,
 occurred_at timestamptz NOT NULL DEFAULT now(), changes jsonb NOT NULL DEFAULT '[]', context jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX audit_entity ON audit_events(entity,entity_id,occurred_at DESC);
CREATE FUNCTION prevent_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit records are append-only'; END;
$$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_events FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
CREATE TABLE legacy_imports (source_digest text PRIMARY KEY, imported_at timestamptz NOT NULL DEFAULT now(), counts jsonb NOT NULL);
