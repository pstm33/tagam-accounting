# TAGAM Accounting Architecture

## 1. Positioning

TAGAM Accounting is an external online module connected to KMRS when a restaurant needs professional inventory, food-cost, recipe-card, and profitability control.

It should be deployable as:

- a hosted SaaS module for many restaurants;
- a private cloud deployment for one restaurant group;
- an optional KMRS-connected product, not a required part of the KMRS core.

It should not depend on one local computer being online. All business data must live in an online database with backups, audit logs, users, permissions, and background sync workers.

## 2. Source Of Truth

| Data | Source of truth | Sync direction |
| --- | --- | --- |
| Orders and statuses | KMRS | KMRS -> Accounting |
| Sales, cancellations, refunds | KMRS | KMRS -> Accounting |
| Customer menu | KMRS | KMRS -> Accounting, then approved exports back |
| Inventory balances | Accounting | Accounting only |
| Purchases and suppliers | Accounting | Accounting only |
| Stock lots and expiry dates | Accounting | Accounting only |
| Recipes and recipe versions | Accounting | Accounting -> KMRS for composition/description |
| Food cost and margins | Accounting | Accounting dashboards |
| Recommended prices | Accounting | Accounting -> KMRS after approval |
| Ingredient-based stop-list | Accounting | Accounting -> KMRS |

## 3. Online Runtime

The production module should have these services:

- Web app: owner, accountant, manager, chef, and storekeeper UI.
- API service: authentication, restaurants, products, recipes, purchases, inventory, reports, and KMRS bridge endpoints.
- Worker service: KMRS order import, stock write-off jobs, price recommendation recalculation, low-stock checks, expiry checks, and report snapshots.
- Database: transactional online database, preferably PostgreSQL for the new module.
- Queue: durable background jobs for imports, exports, recalculations, and retries.
- Object storage: invoices, product photos, write-off photos, supplier documents.
- Audit log: every price, recipe, inventory, and publishing action.

## 4. KMRS Bridge

The bridge must be thin and replaceable. KMRS tells the accounting module what happened; the accounting module decides what it means for stock and profit.

### KMRS -> Accounting

- restaurants/merchant import;
- categories;
- menu items;
- modifiers and add-ons;
- order creation;
- order status changes;
- cancellations and refunds.

### Accounting -> KMRS

- approved price updates;
- approved description/composition/allergen updates;
- gram weight and public nutrition/portion notes;
- stop-list item when key ingredients are unavailable;
- restore item when ingredients are available again.

## 5. Recipe Cards

A KMRS menu item is a sellable item. An accounting recipe card is the economic and production truth behind that item.

Recipe cards must support:

- versioning;
- effective dates;
- gross quantity;
- net quantity;
- prepared output;
- processing yield chain;
- ingredient substitutions;
- semi-finished products;
- target food-cost percent;
- recommended price;
- approval before publishing to KMRS.

Old sales must keep using the recipe version that was active at the sale/write-off moment.

## 6. Processing Yields

Yield rules belong to products by default, but recipe lines can override them.

Examples:

| Product | Processing | Input | Output | Effect |
| --- | --- | ---: | ---: | --- |
| Potato | Cleaning | 1000 g | 780 g | -22% |
| Potato | Frying | 1000 g | 650 g | -35% |
| Beef | Trimming | 1000 g | 920 g | -8% |
| Beef | Frying | 1000 g | 720 g | -28% |
| Rice | Boiling | 1000 g | 2800 g | +180% |

The system must support output below 100% and above 100%. Absorption and boiling can increase prepared weight, while trimming, frying, baking, drying, and portioning usually decrease it.

## 7. Write-Off Timing

The first integration should not write off stock at raw order creation.

Recommended flow:

1. KMRS order created: no stock movement yet, or optional soft demand.
2. Merchant accepts order or sends it to kitchen: reserve ingredients.
3. Order completed successfully: commit stock write-off.
4. Order cancelled before cooking: release reserve.
5. Order cancelled after cooking: move reserve to cancellation/write-off reason.
6. Payment refund after food was prepared: financial correction, not automatic stock return.

## 8. MVP Scope

MVP should include:

- product catalog;
- units and unit conversions;
- processing yield rules;
- suppliers;
- purchases and stock lots;
- recipe cards and versions;
- recipe cost calculation;
- menu item link to KMRS;
- order import contract;
- stock write-off contract;
- food-cost and recommended price calculation.

## 9. Later WOW Layer

- What-if simulator.
- Menu engineering matrix.
- AI manager assistant.
- Production planning.
- Purchase assistant.
- Expiry and lot control.
- Photo write-offs.
- Ingredient-based auto stop-list.
- Variance analysis: theoretical stock vs actual stock.
