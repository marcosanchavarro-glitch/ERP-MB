ALTER TABLE cells DROP CONSTRAINT "cells_groupCode_check";
ALTER TABLE cells ADD CONSTRAINT cells_groupCode_check CHECK(char_length("groupCode")=1 AND "groupCode" COLLATE "und-x-icu" ~ '^[[:alpha:]]$' AND "groupCode"=upper("groupCode" COLLATE "und-x-icu"));
CREATE TABLE import_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token_hash text NOT NULL UNIQUE, actor_id uuid NOT NULL REFERENCES users(id),
 filename text NOT NULL, format text NOT NULL CHECK(format IN ('CSV','XLSX')), status text NOT NULL CHECK(status IN ('COMPLETED','FAILED')),
 counts jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE import_records (
 batch_id uuid NOT NULL REFERENCES import_batches(id), row_number integer NOT NULL,
 person_id uuid REFERENCES people(id), cell_id uuid REFERENCES cells(id), membership_id uuid REFERENCES cell_memberships(id),
 cell_created boolean NOT NULL DEFAULT false, action text NOT NULL CHECK(action IN ('CREATED','SKIPPED')), PRIMARY KEY(batch_id,row_number)
);
CREATE INDEX import_batch_history ON import_batches(actor_id,created_at DESC,id);
CREATE TRIGGER import_batches_immutable BEFORE UPDATE OR DELETE ON import_batches FOR EACH ROW EXECUTE FUNCTION protect_newcomer_history();
CREATE TRIGGER import_records_immutable BEFORE UPDATE OR DELETE ON import_records FOR EACH ROW EXECUTE FUNCTION protect_newcomer_history();
INSERT INTO permissions(key) VALUES ('matriz.importar');
