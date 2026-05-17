# Deployment

TAGAM Accounting is intended to run online. Local tooling is only for development and CI checks.

## Production Pieces

- API container built from the repository `Dockerfile`.
- Managed PostgreSQL database.
- Secure environment variables/secrets.
- Separate migration command before API deployment.
- Later: worker process for KMRS sync, write-offs, reports, and publish queue.

## Required Environment

```bash
DATABASE_URL=postgres://...
API_HOST=0.0.0.0
API_PORT=4010
```

Use a real managed PostgreSQL database for production. Do not use the Docker Compose database for production.

## Release Flow

1. Build and deploy the API container.
2. Run migrations against the managed database:

   ```bash
   npm run db:migrate
   ```

3. Start the API:

   ```bash
   npm run dev:api
   ```

4. For first setup only, create the organization/location and default units through either:

   ```bash
   npm run db:seed:demo
   ```

   or:

   ```http
   POST /v1/bootstrap
   ```

## Health Check

Use:

```http
GET /health
```

The health check verifies both API availability and PostgreSQL connectivity.

## Development Database

If Docker is available locally:

```bash
docker compose up -d postgres
copy .env.example .env
npm run db:migrate
npm run db:seed:demo
npm run dev:api
```

If Docker is not available, use any online PostgreSQL database URL in `.env`.

## CI

CI runs:

```bash
npm ci
npm run typecheck
npm run db:smoke
```

`db:smoke` uses PGlite to validate migrations without requiring a running PostgreSQL server. Production still uses real PostgreSQL.

## Existing VPS Path

For the current TAGAM VPS, use the files in `deploy/vps`:

- `deploy/vps/deploy.ps1` packages the repository from Windows and can upload it through an already configured SSH account.
- `deploy/vps/install.sh` installs the API as a systemd service.
- `deploy/vps/create-postgres-db.sh` creates a dedicated PostgreSQL database/user when PostgreSQL is hosted on the same VPS.
- `deploy/vps/nginx-accounting.tagam.delivery.conf` proxies `accounting.tagam.delivery` to the local API on port `4010`.

The VPS deployment keeps the accounting module separate from the existing KMRS application. KMRS should talk to it through versioned API endpoints and a later bridge worker, not by sharing internal tables.
