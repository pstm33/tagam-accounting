# TAGAM Accounting

External cloud accounting, inventory, recipe-card, food-cost, and profitability module for KMRS/TAGAM restaurants.

This product is designed as an optional online module. It is not a local desktop tool and it should not be hardwired into the KMRS core. KMRS keeps orders, payments, delivery, customer menu, and restaurant workflow. TAGAM Accounting keeps inventory, purchases, supplier costs, lots, recipe cards, processing yields, write-offs, cost calculation, and profitability control.

## Product Rule

Every sale in KMRS should answer three questions:

1. How much did we earn?
2. What was written off?
3. Is the kitchen following the expected recipe and yield?

## Repository Shape

- `apps/api` - future online API service for restaurants, KMRS sync, webhooks, and background jobs.
- `packages/accounting-core` - pure business calculations for yields, recipe cost, food cost, and recommended prices.
- `packages/kmrs-bridge` - contracts for importing KMRS menu/orders and publishing approved changes back.
- `db/migrations` - PostgreSQL migrations for the online accounting database.
- `Dockerfile` - API container for online deployment.
- `docs` - architecture, MVP scope, online deployment model, and data model notes.

## First Milestone

The first milestone is a cloud-ready foundation:

1. Domain model for products, units, processing yield rules, recipe cards, and costs.
2. Cost calculation that supports shrinkage, cooking loss, absorption, and extra waste.
3. KMRS bridge contract for menu/order import and approved price/description/export back to KMRS.
4. Architecture document for SaaS deployment, not local-only usage.

## Development

```bash
npm install
npm run db:smoke
npm run db:migrate
npm run db:seed:demo
npm run dev:api
npm run typecheck
```

The API and migration runner read `DATABASE_URL` from the environment or a local `.env` file.

For local development you can use any PostgreSQL instance. If Docker is available:

```bash
docker compose up -d postgres
copy .env.example .env
npm run db:migrate
npm run db:seed:demo
npm run dev:api
```

Production should use managed online PostgreSQL. The Docker setup is only a development convenience.
