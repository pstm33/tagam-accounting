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
ACCOUNTING_AUTH_MODE=protected
ACCOUNTING_API_KEYS=kmrs_bridge:CHANGE_ME
ACCOUNTING_HMAC_SECRETS=
ACCOUNTING_BRIDGE_SCOPES={"kmrs_bridge":{"organizationIds":["org-id"],"locationIds":["location-id"],"restaurantSlugs":["7sky"],"kmrsMerchantIds":["7"],"baseUrls":["https://tagam.delivery"]}}
```

Auth modes:

- `off` - local development without bridge protection.
- `protected` - only mutating/bridge endpoints require auth.
- `strict` - all `/v1/*` endpoints except public smoke/demo routes require auth.

Supported auth:

- `x-api-key: <secret>` or `Authorization: Bearer <secret>`
- HMAC headers: `x-accounting-key-id`, `x-accounting-timestamp`, `x-accounting-signature`

HMAC signing string:

```text
METHOD
/path?query
ISO_TIMESTAMP
SHA256(canonical_json_body)
```

Bridge scopes:

- `organizationIds` - accounting organizations this credential can access.
- `locationIds` - restaurant/warehouse locations this credential can access.
- `restaurantSlugs` - KMRS public restaurant slugs allowed for pull import.
- `kmrsMerchantIds` - KMRS merchant IDs allowed after the menu is pulled or posted.
- `baseUrls` - allowed KMRS installations, for example `https://tagam.delivery`.
- `kmrsConnectionIds` - optional narrow access to existing connection rows.

If `ACCOUNTING_BRIDGE_SCOPES` is set, a principal without a matching scope cannot import or read KMRS bridge data. If a credential is scoped to specific `locationIds`, bridge read endpoints must include `locationId` so the API does not return another location's data.

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
- `locationId`
- `kmrsConnectionId`
- `limit`

### `GET /v1/kmrs/connections`

Protected in `protected` and `strict` auth modes.

Query params:

- `organizationId`
- `locationId`
- `limit`

Returns KMRS connection rows for the allowed restaurant/location, including base URL, merchant ID, restaurant slug, last sync time, imported item count, and linked item count.

### `GET /v1/kmrs/menu-items`

Protected in `protected` and `strict` auth modes.

Query params:

- `organizationId`
- `locationId`
- `kmrsConnectionId`
- `limit`

Returns imported KMRS menu items and their recipe-link status.

### `PUT /v1/kmrs/menu-items/:kmrsMenuItemId/link`

Protected in `protected` and `strict` auth modes.

Links one imported KMRS menu item to an active recipe version. Existing active links for that KMRS item are archived first.

Required body:

- `organizationId` or `x-organization-id`
- `recipeVersionId`

### `DELETE /v1/kmrs/menu-items/:kmrsMenuItemId/link`

Protected in `protected` and `strict` auth modes.

Archives the active recipe link for an imported KMRS menu item.

Query params:

- `organizationId`

### `POST /v1/kmrs/import/menu`

Protected in `protected` and `strict` auth modes.

Imports a read-only KMRS menu snapshot into accounting. This endpoint does not publish anything back to KMRS and does not create recipes automatically. It only records the external menu buttons that later need mapping to recipe cards.

Required body:

- `organizationId` or `x-organization-id`
- `locationId`
- `baseUrl`
- `kmrsMerchantId`
- `items`

Each item accepts:

- `kmrsItemId`
- `kmrsCategoryId` or `categoryId`
- `name`
- `description`
- `price`
- `currency`
- `isAvailable`
- `rawPayload` or `raw`

### `POST /v1/kmrs/import/menu-from-kmrs`

Protected in `protected` and `strict` auth modes.

Pulls a menu directly from a KMRS public interface endpoint in read-only mode, normalizes it, and stores it through the same import path as `/v1/kmrs/import/menu`.

Required body:

- `organizationId` or `x-organization-id`
- `locationId`
- `restaurantSlug`

Optional body:

- `baseUrl` defaults to `https://tagam.delivery`
- `currencyCode` defaults to `TMT`

Example body:

```json
{
  "organizationId": "37a6eab3-57b5-44c3-a772-d288ac2fa103",
  "locationId": "3c5e4dfc-c6f8-4b99-a6a8-d611e955fd27",
  "restaurantSlug": "7sky"
}
```

### `POST /v1/kmrs/orders/preview-writeoff`

Calculates the theoretical stock write-off for a KMRS sale without changing inventory. The endpoint maps KMRS menu item IDs to active recipe versions, applies recipe yield chains, checks available stock, and returns expected ingredient quantities and cost.

Required body:

- `organizationId` or `x-organization-id`
- `locationId`
- `lines`

Example body:

```json
{
  "organizationId": "37a6eab3-57b5-44c3-a772-d288ac2fa103",
  "locationId": "3c5e4dfc-c6f8-4b99-a6a8-d611e955fd27",
  "kmrsOrderId": "demo-order-1001",
  "lines": [
    {
      "kmrsItemId": "demo-classic-burger",
      "quantity": 2,
      "salePrice": 45,
      "currency": "TMT"
    }
  ]
}
```

### `POST /v1/kmrs/orders/commit-writeoff`

Commits a KMRS sale write-off. It creates a KMRS order record, order lines, an `order_writeoffs` document, FIFO-style negative `stock_movements`, `order_writeoff_lines`, and decreases the matching `stock_lots.current_quantity`.

The endpoint refuses to commit when recipe costing is incomplete, stock is short, or the same KMRS order already has a committed write-off.
