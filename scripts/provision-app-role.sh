#!/usr/bin/env bash
# =============================================================================
# Provision a NON-superuser, NON-BYPASSRLS Postgres app role so Row-Level
# Security actually enforces tenant isolation. The API/worker connect as this
# role (DATABASE_URL); migrations keep using the owner/superuser (ADMIN_URL).
#
# Run once against the marketforge database as the owner/superuser. Idempotent.
# Pass the app password as $1 (or it is generated and printed once).
# =============================================================================
set -euo pipefail

CONTAINER="${PG_CONTAINER:-mf-postgres}"
DB="${POSTGRES_DB:-marketforge}"
OWNER="${POSTGRES_USER:-marketforge}"
APP_ROLE="${APP_ROLE:-marketforge_app}"
APP_PASS="${1:-$(openssl rand -hex 24)}"

docker exec -i "$CONTAINER" psql -U "$OWNER" -d "$DB" -v role="$APP_ROLE" -v pass="$APP_PASS" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'role') THEN
    EXECUTE format('CREATE ROLE %I LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE', :'role');
  END IF;
END $$;
ALTER ROLE :"role" WITH PASSWORD :'pass';
GRANT USAGE ON SCHEMA public TO :"role";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO :"role";
SQL

echo "Provisioned $APP_ROLE. Point DATABASE_URL at it:"
echo "  postgres://$APP_ROLE:<password>@postgres:5432/$DB"
