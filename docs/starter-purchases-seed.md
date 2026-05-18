# Starter Purchases Seed

`npm run seed:starter-purchases` fills the demo organization with starter supplier prices, receiving documents, invoices, stock lots, stock movements, vendor items, and supplier price history.

The seed is intentionally idempotent per `STARTER_PRICE_DATE`: if a receiving document like `STARTER-PRICE-2026-05-18-MEAT` already exists for the location, that supplier batch is skipped.

Price sources:

- Local Ashgabat benchmarks from Progres Palaw Index March 2026 and Numbeo Ashgabat May 2026.
- Regional/import estimates where local prices were not available.
- Import fallback formula: `1 USD = 20 TMT`, plus `30%` logistics, so `1 USD = 26 TMT` for starter costing.

Packaging products remain stock items, but recipe costing treats them as delivery-only lines. Dine-in costing excludes products with `product_type = 'packaging'`; KMRS writeoff preview/commit defaults to `delivery` and includes packaging unless a line explicitly uses `fulfillmentType: "dine_in"`.
