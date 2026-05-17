# Database

PostgreSQL is the target database for TAGAM Accounting.

Apply migrations in filename order. The first migration is a foundation schema for the SaaS module, KMRS bridge, inventory ledger, recipes, purchasing, and profitability snapshots.

```bash
psql "$DATABASE_URL" -f db/migrations/001_initial_accounting_schema.sql
```

The application migration runner keeps its own migration table:

```bash
npm run db:migrate
```

For CI or local schema sanity checks without a running PostgreSQL server:

```bash
npm run db:smoke
```

To create demo restaurant data after migrating a real PostgreSQL database:

```bash
npm run db:seed:demo
```
