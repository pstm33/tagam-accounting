#!/usr/bin/env bash
set -euo pipefail

DATABASE_NAME="${DATABASE_NAME:-tagam_accounting}"
DATABASE_USER="${DATABASE_USER:-tagam_accounting}"
DATABASE_PASSWORD="${DATABASE_PASSWORD:-}"

if [[ -z "$DATABASE_PASSWORD" ]]; then
  echo "DATABASE_PASSWORD is required." >&2
  exit 2
fi

if [[ ! "$DATABASE_NAME" =~ ^[a-zA-Z0-9_]+$ ]]; then
  echo "DATABASE_NAME may contain only letters, numbers, and underscores." >&2
  exit 2
fi

if [[ ! "$DATABASE_USER" =~ ^[a-zA-Z0-9_]+$ ]]; then
  echo "DATABASE_USER may contain only letters, numbers, and underscores." >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed. Install PostgreSQL client/server first." >&2
  exit 2
fi

if command -v sudo >/dev/null 2>&1; then
  POSTGRES_PSQL=(sudo -u postgres psql)
else
  POSTGRES_PSQL=(runuser -u postgres -- psql)
fi

"${POSTGRES_PSQL[@]}" -d postgres \
  -v ON_ERROR_STOP=1 \
  -v db_name="$DATABASE_NAME" \
  -v db_user="$DATABASE_USER" \
  -v db_password="$DATABASE_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'db_user', :'db_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'db_user') \gexec

SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'db_user', :'db_password') \gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'db_name', :'db_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name') \gexec

SELECT format('ALTER DATABASE %I OWNER TO %I', :'db_name', :'db_user') \gexec
SQL

echo "PostgreSQL database is ready: ${DATABASE_NAME}"
