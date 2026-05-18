# Starter menu TTK seed

`scripts/seed-starter-menu-ttk.mjs` fills an imported KMRS menu with starter restaurant accounting data:

- nested product categories for raw ingredients, prepared items, and delivery packaging;
- ingredient products with rough default waste percentages;
- semi-finished prep cards such as sushi rice, spicy sauce, pizza dough, WOK sauce, miso base, tom yum base, broth, and grill marinade;
- draft/generated menu recipe lines based on the KMRS dish name and category;
- optional activation of filled menu recipes for KMRS writeoff testing.

The script is intentionally conservative:

- it uses the public API and web/API auth, not direct database edits;
- it does not delete recipe lines;
- by default it skips non-empty recipes so manually edited TTKs are not overwritten;
- it writes starter norms only. A technologist still needs to check portion weights, yield, frying loss, packaging, and local process rules.

## Run

Dry run:

```powershell
$env:ACCOUNTING_BASE_URL = "https://demo-accounting.tagam.delivery"
$env:ACCOUNTING_USERNAME = "admin"
$env:ACCOUNTING_PASSWORD = "<password>"
node scripts\seed-starter-menu-ttk.mjs --dry-run --activate
```

Apply:

```powershell
$env:ACCOUNTING_BASE_URL = "https://demo-accounting.tagam.delivery"
$env:ACCOUNTING_USERNAME = "admin"
$env:ACCOUNTING_PASSWORD = "<password>"
node scripts\seed-starter-menu-ttk.mjs --activate
```

Options:

- `--dry-run` calculates what would be created without writing.
- `--activate` activates generated menu recipes after lines are added.
- `--append` appends lines even when a recipe already has lines. Use only for controlled repairs, because it can duplicate ingredients.

## Source assumptions

The seed uses broad public recipe/TTK references only as a starting point:

- sushi rice seasoning ratios: rice vinegar, sugar, salt;
- common roll structure: rice, nori, protein, cream cheese, cucumber/avocado, sauces;
- pizza dough/sauce/cheese proportions;
- miso and tom yum ingredient profiles;
- burger and grill starter portions.

These are not final production cards. Before using them for real writeoff, verify actual gross/net weights, yields, supplier specs, and kitchen process losses for each restaurant.

## Current demo result

The first demo run filled the `Ashgabat Demo Kitchen / 7sky` imported menu:

- 89 products in the ingredient catalog;
- 169 recipe versions total;
- 157 active menu recipes with ingredient lines;
- 12 prep/semi-finished recipe cards;
- 159 KMRS menu items linked.

Food-cost calculation for newly created ingredients will remain incomplete until purchase receipts or starting stock lots are loaded with unit costs.
