# Database Model

The first database target is PostgreSQL. The schema is designed for an online SaaS/private-cloud module, not a local-only application.

## Core Principles

- Every restaurant group is an organization.
- Every restaurant, kitchen, warehouse, bar, or commissary is a location.
- Quantities and money use decimals, not floating point.
- Stock movements are immutable ledger rows.
- Current stock is derived from movements and optionally cached.
- Recipes are versioned.
- Old orders keep the recipe version active at the time of reservation/write-off.
- Supplier items are not internal products. They map to products after review.
- KMRS menu items and modifiers map to recipes or recipe deltas.
- Publishing to KMRS goes through an approval queue.

## Main Areas

### SaaS And Access

- `organizations`
- `locations`
- `app_users`
- `organization_memberships`
- `audit_log`
- `accounting_periods`

### Catalog

- `units`
- `unit_conversions`
- `product_categories`
- `products`
- `processing_methods`
- `product_yield_rules`
- `allergens`
- `product_allergens`
- `dietary_tags`
- `product_dietary_tags`

### Suppliers And Purchasing

- `suppliers`
- `vendor_items`
- `purchase_orders`
- `purchase_order_lines`
- `receiving_documents`
- `receiving_lines`
- `invoice_documents`
- `invoice_lines`
- `invoice_discrepancies`
- `supplier_price_history`
- `order_guides`
- `order_guide_lines`

### Inventory

- `stock_lots`
- `stock_movements`
- `stock_reservations`
- `count_sheets`
- `count_sheet_lines`
- `inventory_counts`
- `inventory_count_lines`
- `transfers`
- `transfer_lines`
- `writeoff_documents`
- `writeoff_lines`

### Recipes

- `recipes`
- `recipe_versions`
- `recipe_lines`
- `recipe_line_processing`
- `recipe_steps`
- `recipe_nutrition_snapshots`
- `recipe_cost_snapshots`
- `recipe_cost_snapshot_lines`
- `production_batches`
- `production_batch_inputs`
- `production_batch_outputs`

### KMRS Bridge

- `kmrs_connections`
- `kmrs_menu_items`
- `kmrs_modifier_items`
- `kmrs_menu_recipe_links`
- `kmrs_orders`
- `kmrs_order_lines`
- `kmrs_sync_runs`
- `kmrs_publish_queue`

### Profitability And Reporting

- `order_writeoffs`
- `order_writeoff_lines`
- `theoretical_usage_snapshots`
- `actual_usage_snapshots`
- `usage_variance_snapshots`
- `menu_engineering_snapshots`
- `price_recommendations`

## Why This Shape

The benchmark products show that the difficult parts are not CRUD screens. The hard parts are mapping supplier SKUs to internal products, mapping POS/KMRS buttons and modifiers to recipes, keeping recipe yields reliable, reconciling theoretical usage with actual usage, and publishing menu changes without breaking restaurant operations.

The initial migration keeps these parts explicit so TAGAM Accounting can grow into a serious restaurant back-office product.
