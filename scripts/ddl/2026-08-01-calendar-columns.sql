-- Calendar model columns on content_items (Slice 2 of the Original Plan build).
-- db:push is NOT incremental in this project, so apply incremental schema changes
-- with direct DDL. Idempotent — safe to re-run.
--
--   Apply on the VPS:  docker exec -i mf-postgres psql "$ADMIN_URL" < this.sql
--   Local:             psql "$ADMIN_DATABASE_URL" -f this.sql

ALTER TABLE content_items ADD COLUMN IF NOT EXISTS scheduled_date date;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS slot_index integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS content_items_scheduled_date_idx ON content_items (scheduled_date);
