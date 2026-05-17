# API

The API is an online service. It requires a PostgreSQL database through `DATABASE_URL`.

## Local Commands

```bash
npm run db:smoke
npm run db:check
npm run db:migrate
npm run db:seed:demo
npm run dev:api
```

The current default port is `4010`.

## Environment

Use `.env.example` as the starting point:

```bash
DATABASE_URL=postgres://tagam:tagam@localhost:5432/tagam_accounting
API_HOST=0.0.0.0
API_PORT=4010
```

## Endpoints

### `GET /health`

Checks API and database connectivity.

### `GET /`

Serves the lightweight demo dashboard. It loads `/v1/demo`, inventory, and recipe costing from the API and is intended as the first smoke test for the online module.

### `GET /v1/demo`

Returns the seeded demo organization, primary location, first active recipe version, and small health counters. This is useful for opening the demo API without manually looking up IDs.

### `GET /v1/organizations`

Lists organizations with location/product/recipe counters.

### `POST /v1/bootstrap`

Creates the first organization, restaurant location, and default units.

Required body:

- `organizationName`

Optional body:

- `legalName`
- `defaultCurrency`
- `timezone`
- `locationName`
- `kmrsMerchantId`

### `GET /v1/catalog`

Query params:

- `organizationId`

Returns:

- `locations`
- `units`
- `categories`
- `processingMethods`

### `GET /v1/products`

Query params:

- `organizationId`
- `search`
- `limit`

The organization can also be passed as `x-organization-id`.

### `POST /v1/products`

Creates a product.

Required body:

- `organizationId` or `x-organization-id`
- `baseUnitId`
- `name`

Optional body:

- `categoryId`
- `sku`
- `productType`
- `inventoryPolicy`
- `defaultWastePercent`

### `GET /v1/recipes`

Query params:

- `organizationId`
- `status`
- `limit`

### `GET /v1/recipes/:recipeVersionId`

Query params:

- `organizationId`
- `locationId`

Returns the recipe version with ingredient lines and live average-cost calculations from current stock lots. The response includes yield loss/absorption effects, stock input quantity, line cost, total cost, food-cost percent, gross margin, and recommended menu price when enough data exists.

### `GET /v1/inventory/summary`

Query params:

- `organizationId`
- `locationId`
- `limit`

### `GET /v1/kmrs/sync-runs`

Query params:

- `organizationId`
- `limit`
