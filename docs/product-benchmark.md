# Product Benchmark Notes

Research date: 2026-05-17.

This file captures the practical database lessons from strong products in restaurant inventory, recipe costing, purchasing, and profitability.

## Products Reviewed

### Restaurant365

Official source: https://www.restaurant365.com/inventory/

Observed capabilities:

- cloud inventory and prep;
- exact recipe cost;
- recipe scaling;
- AI-driven purchase orders based on demand;
- invoice discrepancy detection;
- received items syncing into inventory;
- commissary, transfers, production, and demand tracking.

Database implications:

- recipe versions need scalable yields and prep output;
- purchase orders, receiving, and invoice lines should be separate enough to compare ordered vs received vs invoiced;
- transfers and production should be first-class stock movements;
- multi-location support cannot be bolted on later.

### MarginEdge

Official source: https://help.marginedge.com/hc/en-us/articles/360057072773-MarginEdge-At-A-Glance-An-Overview

Observed capabilities:

- theoretical usage from POS product mix compared with actual usage from inventory and purchases;
- vendors, vendor items, order guides, vendor item history;
- product categories, units of measure, vendor item associations, new item review;
- recipes, prepared items, bar items, menu item margin tracking, menu analysis;
- count sheets and inventory entries;
- POS/PMIX mapping to products or recipes;
- accounting exports, sales mapping, vendor mapping, close books.

Database implications:

- keep vendor SKU mapping distinct from internal products;
- imported invoice items need review status before they become trusted products;
- POS/KMRS menu items must map to recipes, not only to products;
- count sheets are reusable templates, not just one-off counts;
- theoretical usage and actual usage need report tables/snapshots;
- accounting periods and closing dates should exist even if accounting export is later.

### meez

Official source: https://www.getmeez.com/

Observed capabilities:

- recipes as a single source of truth for culinary and finance teams;
- yield-adjusted production-ready recipe data;
- recipe scaling by batch, yield, or ingredient;
- integrations with other systems;
- nutrition and allergen data.

Database implications:

- recipes need instructions, steps, media, training notes, allergens, and dietary/nutrition fields;
- recipe versions should publish clean production data to connected systems;
- yields must be explicit and versioned;
- allergens should be inherited through sub-recipes.

### Apicbase

Official source: https://get.apicbase.com/menu-engineering/

Observed capabilities:

- costed and portioned recipes/sub-recipes;
- step-by-step methods and dietary info;
- menu engineering with profitability and sales data;
- reliable yields, wastage, shrinkage, production timings, and SOPs;
- automatic bills of materials.

Database implications:

- recipe lines need processing/yield chains, not one fixed loss percent;
- menu engineering needs sales volume, cost, margin, and category snapshots;
- BOM generation should be possible directly from active recipe versions;
- SOPs and production timings belong near recipe versions.

### xtraCHEF by Toast

Official source: https://support.toasttab.com/en/article/Using-xtraCHEF-with-Toast

Observed capabilities:

- AP automation and invoice digitization;
- ingredient-level price fluctuations;
- food cost and operating margin reporting;
- improved purchasing decisions.

Database implications:

- invoice documents need source, OCR/EDI/manual metadata, images/files, and review state;
- line-level price history should be queryable per product and supplier;
- purchasing decisions need last price, average price, supplier reliability, and discrepancy history.

### Craftable

Official source: https://help.craftable.com/learning/creating-recipes-and-subrecipes

Observed capabilities:

- recipes and sub-recipes;
- volume/weight calculations and size override;
- burn-off/cooked-down yield handling;
- recipe unit cost, cost percent, menu price calculator, final price with tax;
- prep time, shelf life, storage temp, allergens, instructions with images;
- POS item and modifier mapping.

Database implications:

- recipe yield override is required;
- output size can differ from ingredient sum because of cooking loss or absorption;
- recipe costing must support menu price, tax, and target cost percent;
- modifiers need recipe deltas, not only text mappings.

## TAGAM Accounting Decisions

These benchmark products point to the same foundations:

1. Multi-tenant, multi-location database from day one.
2. Internal product catalog separate from supplier/vendor SKUs.
3. Product yield rules plus recipe-line overrides.
4. Recipes, sub-recipes, and semi-finished products as one graph.
5. KMRS menu item and modifier mapping to recipe versions.
6. Immutable stock ledger instead of only mutable balances.
7. Purchase order, receiving, invoice, and discrepancy workflow.
8. Count sheet templates and inventory counts.
9. Theoretical vs actual usage snapshots.
10. Price recommendation and manual approval before publishing to KMRS.
