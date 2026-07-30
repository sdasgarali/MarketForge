#!/bin/sh
# Creates the separate `n8n` database inside the same Postgres instance so the
# n8n queue-mode stack (ADR-005) does not share tables with the app schema.
# Runs once on first container init (empty pgdata volume). Idempotent-guarded.
set -eu

N8N_DB="${N8N_DB:-n8n}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
SELECT 'CREATE DATABASE ${N8N_DB}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${N8N_DB}')\gexec
SQL

echo "[init] ensured database '${N8N_DB}' exists"
