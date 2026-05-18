#!/usr/bin/env node

import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL || "";
const organizationName = process.env.ACCOUNTING_ORGANIZATION_NAME || "TAGAM Demo Restaurant";
const organizationId = process.env.ACCOUNTING_ORGANIZATION_ID || "";
const locationName = process.env.ACCOUNTING_LOCATION_NAME || "Ashgabat Demo Kitchen";
const locationId = process.env.ACCOUNTING_LOCATION_ID || "";
const batchDate = process.env.STARTER_PRICE_DATE || "2026-05-18";
const currency = "TMT";

const usdToTmt = 20;
const logisticsPercent = 30;
const importedMultiplier = usdToTmt * (1 + logisticsPercent / 100);

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const supplierDefinitions = {
  meat: {
    code: "MEAT",
    name: "Ашхабад: мясо и птица",
    paymentTerms: "стартовые цены; локальный рынок Ашхабада",
    reliabilityScore: 0.82,
  },
  produce: {
    code: "PRODUCE",
    name: "Ашхабад: овощной рынок",
    paymentTerms: "стартовые цены; локальный рынок Ашхабада",
    reliabilityScore: 0.78,
  },
  grocery: {
    code: "GROCERY",
    name: "Бакалея и молочные продукты",
    paymentTerms: "стартовые цены; локальные/региональные ориентиры",
    reliabilityScore: 0.8,
  },
  import: {
    code: "IMPORT",
    name: "Импорт: суши и азиатская бакалея",
    paymentTerms: "расчет: USD * 20 TMT + 30% логистика",
    reliabilityScore: 0.72,
  },
  packaging: {
    code: "PACK",
    name: "Упаковка для доставки",
    paymentTerms: "стартовые цены; локальные/региональные ориентиры",
    reliabilityScore: 0.76,
  },
};

const exactPrices = new Map([
  ["Говядина сырая", priceKg(85, "progres_palaw_march_2026")],
  ["Телятина", priceKg(105, "estimate_local")],
  ["Мякоть баранины", priceKg(95, "estimate_local")],
  ["Ребра бараньи", priceKg(90, "estimate_local")],
  ["Филе курицы", priceKg(70, "numbeo_ashgabat_may_2026")],
  ["Голень куриная", priceKg(50, "estimate_local")],
  ["Крылья куриные", priceKg(45, "estimate_local")],
  ["Рис для суши сырой", priceKg(22, "numbeo_ashgabat_may_2026")],
  ["Мука пшеничная", priceKg(9, "progres_palaw_march_2026")],
  ["Дрожжи сухие", priceKg(80, "estimate_local")],
  ["Масло растительное", priceKg(18, "progres_palaw_march_2026")],
  ["Сахар", priceKg(14, "estimate_local")],
  ["Соль", priceKg(4, "estimate_local")],
  ["Сыр чеддер", priceKg(132, "numbeo_ashgabat_may_2026")],
  ["Сыр моцарелла", priceKg(135, "numbeo_ashgabat_may_2026")],
  ["Сливочный сыр", priceKg(145, "estimate_local")],
  ["Сыр фета", priceKg(125, "estimate_local")],
  ["Голубой сыр", priceKg(210, "import_formula_usd_8_08_per_kg")],
  ["Сыр пармезан", priceKg(230, "import_formula_usd_8_85_per_kg")],
  ["Яйцо", priceKg(35, "numbeo_ashgabat_may_2026")],
  ["Лук репчатый", priceKg(5, "numbeo_ashgabat_may_2026")],
  ["Морковь", priceKg(8, "progres_palaw_march_2026")],
  ["Капуста", priceKg(8, "estimate_local")],
  ["Помидор", priceKg(13, "numbeo_ashgabat_may_2026")],
  ["Огурец", priceKg(16, "estimate_local")],
  ["Перец болгарский", priceKg(22, "estimate_local")],
  ["Баклажан", priceKg(16, "estimate_local")],
  ["Кабачок", priceKg(16, "estimate_local")],
  ["Шампиньоны", priceKg(35, "estimate_local")],
  ["Картофель фри", priceKg(24, "estimate_local")],
  ["Салатный микс", priceKg(45, "estimate_local")],
  ["Лист салата", priceKg(45, "numbeo_ashgabat_may_2026")],
  ["Кинза", priceKg(80, "estimate_local")],
  ["Базилик", priceKg(120, "estimate_local")],
  ["Чеснок", priceKg(45, "estimate_local")],
  ["Имбирь", priceKg(65, "estimate_local")],
  ["Перец чили", priceKg(70, "estimate_local")],
  ["Лайм", priceKg(45, "estimate_local")],
  ["Авокадо", priceKg(70, "estimate_import_regional")],
  ["Ананас", priceKg(34, "estimate_import_regional")],
  ["Груша", priceKg(26, "estimate_local")],
  ["Кукуруза", priceKg(18, "estimate_local")],
  ["Маринованные огурцы", priceKg(28, "estimate_local")],
  ["Томатное пюре", priceKg(25, "estimate_local")],
  ["Майонез", priceKg(35, "estimate_local")],
  ["Фирменный соус для бургера", priceKg(45, "estimate_local")],
  ["Соус цезарь", priceKg(70, "estimate_local")],
  ["Смесь специй", priceKg(90, "estimate_local")],
  ["Филе лосося", priceKg(importUsd(18), "import_formula_usd_18_per_kg")],
  ["Филе тунца", priceKg(importUsd(20), "import_formula_usd_20_per_kg")],
  ["Угорь унаги", priceKg(importUsd(28), "import_formula_usd_28_per_kg")],
  ["Креветка очищенная", priceKg(importUsd(12.1), "import_formula_usd_12_10_per_kg")],
  ["Крабовый микс", priceKg(importUsd(8.1), "import_formula_usd_8_10_per_kg")],
  ["Икра масаго", priceKg(importUsd(35), "import_formula_usd_35_per_kg")],
  ["Мидии", priceKg(importUsd(8.1), "import_formula_usd_8_10_per_kg")],
  ["Кольца кальмара", priceKg(importUsd(6.9), "import_formula_usd_6_90_per_kg")],
  ["Лист нори", pricePcs(importUsd(0.12), "import_formula_usd_0_12_per_sheet")],
  ["Рисовый уксус", priceKg(importUsd(3), "import_formula_usd_3_per_kg")],
  ["Кунжут", priceKg(120, "estimate_import_regional")],
  ["Кунжутное масло", priceKg(importUsd(5.8), "import_formula_usd_5_80_per_kg")],
  ["Соус шрирача", priceKg(importUsd(4.2), "import_formula_usd_4_20_per_kg")],
  ["Соевый соус", priceKg(importUsd(2.5), "import_formula_usd_2_50_per_kg")],
  ["Соус терияки", priceKg(importUsd(3.65), "import_formula_usd_3_65_per_kg")],
  ["Устричный соус", priceKg(importUsd(3.85), "import_formula_usd_3_85_per_kg")],
  ["Сладкий чили соус", priceKg(importUsd(2.9), "import_formula_usd_2_90_per_kg")],
  ["Рыбный соус", priceKg(importUsd(3.25), "import_formula_usd_3_25_per_kg")],
  ["Паста мисо", priceKg(importUsd(10), "import_formula_usd_10_per_kg")],
  ["Даши порошок", priceKg(importUsd(25), "import_formula_usd_25_per_kg")],
  ["Вакаме", priceKg(importUsd(20), "import_formula_usd_20_per_kg")],
  ["Тофу", priceKg(80, "estimate_import_regional")],
  ["Паста том ям", priceKg(importUsd(10), "import_formula_usd_10_per_kg")],
  ["Кокосовое молоко", priceKg(importUsd(3.45), "import_formula_usd_3_45_per_kg")],
  ["Лемонграсс", priceKg(importUsd(4.6), "import_formula_usd_4_60_per_kg")],
  ["Мука темпура", priceKg(45, "estimate_import_regional")],
  ["Панировочные сухари панко", priceKg(60, "estimate_import_regional")],
  ["Лапша яичная", priceKg(45, "estimate_import_regional")],
  ["Лапша удон", priceKg(55, "estimate_import_regional")],
  ["Лапша рисовая", priceKg(50, "estimate_import_regional")],
  ["Пепперони", priceKg(160, "estimate_import_regional")],
  ["Ветчина", priceKg(90, "estimate_local")],
  ["Веганская котлета", priceKg(120, "estimate_import_regional")],
  ["Овощная смесь WOK", priceKg(20, "estimate_local")],
  ["Сухарики", priceKg(35, "estimate_local")],
  ["Булочка для бургера", pricePcs(1.5, "estimate_local")],
  ["Черная булочка для бургера", pricePcs(2.2, "estimate_local")],
  ["Бургер-бокс", pricePcs(0.8, "estimate_local")],
  ["Пицца-бокс", pricePcs(2.5, "estimate_local")],
  ["Суши-бокс", pricePcs(1.8, "estimate_local")],
  ["WOK-бокс", pricePcs(1.6, "estimate_local")],
]);

const sources = [
  {
    code: "progres_palaw_march_2026",
    url: "https://progres.online/palaw-index/palaw-index-march-2026/",
    note: "Ashgabat Palaw Index, March 2026: meat, rice, flour, onion, carrot, sunflower oil trend and meat benchmark.",
  },
  {
    code: "numbeo_ashgabat_may_2026",
    url: "https://www.numbeo.com/cost-of-living/in/Ashgabat",
    note: "Ashgabat market prices updated 4 May 2026: rice, eggs, cheese, chicken, beef, tomatoes, potatoes, onions, lettuce.",
  },
  {
    code: "import_formula",
    url: "manual_formula",
    note: `Fallback import estimate: 1 USD = ${usdToTmt} TMT plus ${logisticsPercent}% logistics, multiplier ${importedMultiplier} TMT/USD.`,
  },
];

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  await client.query("begin");
  const org = await findOrganization();
  const location = await findLocation(org.id);
  const units = await loadUnits(org.id);
  const suppliers = await ensureSuppliers(org.id);
  const products = await loadProducts(org.id);
  const grouped = groupProducts(products);
  const counters = {
    suppliers: Object.keys(suppliers).length,
    vendorItems: 0,
    receivingDocuments: 0,
    receivingLines: 0,
    invoiceDocuments: 0,
    invoiceLines: 0,
    stockLots: 0,
    stockMovements: 0,
    priceHistory: 0,
    skippedDocuments: 0,
    fallbackPrices: 0,
  };

  for (const [supplierKey, items] of grouped.entries()) {
    const supplier = suppliers[supplierKey];
    const documentNumber = `STARTER-PRICE-${batchDate}-${supplier.code}`;
    const existingDocument = await client.query(
      "select id from receiving_documents where organization_id = $1 and location_id = $2 and document_number = $3 limit 1",
      [org.id, location.id, documentNumber],
    );

    if (existingDocument.rows[0]) {
      counters.skippedDocuments += 1;
      continue;
    }

    const receivingDocumentId = await insertReceivingDocument(org.id, location.id, supplier.id, documentNumber);
    counters.receivingDocuments += 1;
    const lineResults = [];

    for (const product of items) {
      const priced = priceForProduct(product);
      const purchase = purchasePlan(product, priced, units);
      if (priced.source.startsWith("fallback")) {
        counters.fallbackPrices += 1;
      }

      const vendorItemId = await upsertVendorItem(org.id, supplier.id, product, purchase);
      counters.vendorItems += 1;
      const receivingLineId = await insertReceivingLine(receivingDocumentId, vendorItemId, product, purchase);
      counters.receivingLines += 1;
      const stockLotId = await insertStockLot(org.id, location.id, product, receivingLineId, purchase);
      counters.stockLots += 1;
      await insertStockMovement(org.id, location.id, product, stockLotId, receivingLineId, purchase);
      counters.stockMovements += 1;
      lineResults.push({
        product,
        purchase,
        vendorItemId,
        receivingLineId,
      });
    }

    const invoiceDocumentId = await insertInvoiceDocument(org.id, location.id, supplier.id, receivingDocumentId, documentNumber, lineResults);
    counters.invoiceDocuments += 1;

    for (const line of lineResults) {
      const invoiceLineId = await insertInvoiceLine(invoiceDocumentId, line);
      counters.invoiceLines += 1;
      await insertPriceHistory(org.id, supplier.id, line, invoiceLineId);
      counters.priceHistory += 1;
    }
  }

  await client.query("commit");
  console.log(JSON.stringify({ ok: true, organizationId: org.id, locationId: location.id, batchDate, counters }, null, 2));
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}

function priceKg(tmtPerKg, source) {
  return { purchaseUnitCode: "kg", pricePerPurchaseUnit: roundMoney(tmtPerKg), source };
}

function pricePcs(tmtPerPcs, source) {
  return { purchaseUnitCode: "pcs", pricePerPurchaseUnit: roundMoney(tmtPerPcs), source };
}

function importUsd(usd) {
  return roundMoney(usd * importedMultiplier);
}

function roundMoney(value) {
  return Math.round(value * 1000) / 1000;
}

async function findOrganization() {
  if (organizationId) {
    const byId = await client.query("select id, name from organizations where id = $1 limit 1", [organizationId]);
    if (byId.rows[0]) {
      return byId.rows[0];
    }
  }

  const result = await client.query(
    "select id, name from organizations where name = $1 order by created_at desc limit 1",
    [organizationName],
  );

  if (!result.rows[0]) {
    throw new Error(`Organization was not found: ${organizationName}`);
  }

  return result.rows[0];
}

async function findLocation(orgId) {
  if (locationId) {
    const byId = await client.query("select id, name from locations where organization_id = $1 and id = $2 limit 1", [
      orgId,
      locationId,
    ]);
    if (byId.rows[0]) {
      return byId.rows[0];
    }
  }

  const result = await client.query(
    `
      select id, name
      from locations
      where organization_id = $1
      order by case when name = $2 then 0 else 1 end, is_active desc, created_at
      limit 1
    `,
    [orgId, locationName],
  );

  if (!result.rows[0]) {
    throw new Error(`Location was not found for organization ${orgId}`);
  }

  return result.rows[0];
}

async function loadUnits(orgId) {
  const result = await client.query(
    "select id, code from units where organization_id = $1 and code in ('g', 'kg', 'pcs')",
    [orgId],
  );
  const units = Object.fromEntries(result.rows.map((row) => [row.code, row]));

  for (const code of ["g", "kg", "pcs"]) {
    if (!units[code]) {
      throw new Error(`Missing unit ${code}`);
    }
  }

  return units;
}

async function ensureSuppliers(orgId) {
  const suppliers = {};

  for (const [key, supplier] of Object.entries(supplierDefinitions)) {
    const result = await client.query(
      `
        insert into suppliers (
          organization_id,
          name,
          payment_terms,
          reliability_score,
          is_active
        )
        values ($1, $2, $3, $4, true)
        on conflict (organization_id, name)
        do update set
          payment_terms = excluded.payment_terms,
          reliability_score = excluded.reliability_score,
          is_active = true,
          updated_at = now()
        returning id, name
      `,
      [orgId, supplier.name, supplier.paymentTerms, supplier.reliabilityScore],
    );
    suppliers[key] = { ...supplier, id: result.rows[0].id };
  }

  return suppliers;
}

async function loadProducts(orgId) {
  const result = await client.query(
    `
      select
        p.id,
        p.name,
        p.product_type as "productType",
        p.base_unit_id as "baseUnitId",
        u.code as "baseUnitCode",
        coalesce(pc.name, '') as "categoryName"
      from products p
      join units u on u.id = p.base_unit_id
      left join product_categories pc on pc.id = p.category_id
      where p.organization_id = $1
        and p.is_active = true
        and p.inventory_policy <> 'not_tracked'
      order by p.name
    `,
    [orgId],
  );

  if (result.rows.length === 0) {
    throw new Error("No active tracked products were found");
  }

  return result.rows;
}

function groupProducts(products) {
  const grouped = new Map();

  for (const product of products) {
    const key = supplierKeyForProduct(product);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(product);
  }

  return grouped;
}

function supplierKeyForProduct(product) {
  const haystack = `${product.name} ${product.categoryName} ${product.productType}`.toLocaleLowerCase("ru-RU");

  if (product.productType === "packaging" || haystack.includes("упаков")) {
    return "packaging";
  }

  if (
    haystack.includes("лосос") ||
    haystack.includes("тунец") ||
    haystack.includes("угор") ||
    haystack.includes("кревет") ||
    haystack.includes("краб") ||
    haystack.includes("масаго") ||
    haystack.includes("миди") ||
    haystack.includes("кальмар") ||
    haystack.includes("нори") ||
    haystack.includes("вакаме") ||
    haystack.includes("мисо") ||
    haystack.includes("даши") ||
    haystack.includes("том ям") ||
    haystack.includes("шрирач") ||
    haystack.includes("терияки") ||
    haystack.includes("устрич") ||
    haystack.includes("рыбный соус") ||
    haystack.includes("темпур") ||
    haystack.includes("панко") ||
    haystack.includes("удон")
  ) {
    return "import";
  }

  if (
    haystack.includes("говя") ||
    haystack.includes("баран") ||
    haystack.includes("теля") ||
    haystack.includes("курин") ||
    haystack.includes("куриц") ||
    haystack.includes("ветчин") ||
    haystack.includes("пепперони")
  ) {
    return "meat";
  }

  if (
    haystack.includes("овощ") ||
    haystack.includes("фрукт") ||
    haystack.includes("помид") ||
    haystack.includes("огур") ||
    haystack.includes("лук") ||
    haystack.includes("морков") ||
    haystack.includes("капуст") ||
    haystack.includes("салат") ||
    haystack.includes("баклаж") ||
    haystack.includes("кабач") ||
    haystack.includes("перец") ||
    haystack.includes("кинз") ||
    haystack.includes("базилик") ||
    haystack.includes("лайм") ||
    haystack.includes("авокад") ||
    haystack.includes("ананас") ||
    haystack.includes("груша") ||
    haystack.includes("шампин")
  ) {
    return "produce";
  }

  return "grocery";
}

function priceForProduct(product) {
  const exact = exactPrices.get(product.name);

  if (exact) {
    return exact;
  }

  const haystack = `${product.name} ${product.categoryName}`.toLocaleLowerCase("ru-RU");

  if (product.baseUnitCode === "pcs") {
    return pricePcs(product.productType === "packaging" ? 1.8 : 2, "fallback_pcs");
  }

  if (haystack.includes("сыр") || haystack.includes("молоч")) {
    return priceKg(132, "fallback_dairy");
  }

  if (supplierKeyForProduct(product) === "meat") {
    return priceKg(85, "fallback_meat");
  }

  if (supplierKeyForProduct(product) === "produce") {
    return priceKg(20, "fallback_produce");
  }

  if (supplierKeyForProduct(product) === "import") {
    return priceKg(importUsd(6), "fallback_import_formula_usd_6_per_kg");
  }

  return priceKg(45, "fallback_grocery");
}

function purchasePlan(product, priced, units) {
  const purchaseUnit = units[priced.purchaseUnitCode];
  const baseUnit = units[product.baseUnitCode];

  if (!purchaseUnit || !baseUnit) {
    throw new Error(`Missing purchase/base unit for ${product.name}`);
  }

  const purchaseQuantity = defaultPurchaseQuantity(product, priced.purchaseUnitCode);
  const baseQuantity = priced.purchaseUnitCode === "kg" && product.baseUnitCode === "g"
    ? purchaseQuantity * 1000
    : purchaseQuantity;
  const purchaseToInventoryFactor = baseQuantity / purchaseQuantity;
  const baseUnitCost = priced.pricePerPurchaseUnit / purchaseToInventoryFactor;
  const lineTotal = priced.pricePerPurchaseUnit * purchaseQuantity;

  return {
    purchaseUnitId: purchaseUnit.id,
    purchaseUnitCode: priced.purchaseUnitCode,
    inventoryUnitId: baseUnit.id,
    inventoryUnitCode: product.baseUnitCode,
    purchaseQuantity,
    baseQuantity,
    purchaseToInventoryFactor,
    pricePerPurchaseUnit: priced.pricePerPurchaseUnit,
    baseUnitCost,
    lineTotal,
    source: priced.source,
    lotCode: lotCodeFor(product, priced.source),
  };
}

function defaultPurchaseQuantity(product, purchaseUnitCode) {
  const supplierKey = supplierKeyForProduct(product);

  if (purchaseUnitCode === "pcs") {
    if (product.productType === "packaging") {
      return 100;
    }
    return product.name.includes("Лист нори") ? 500 : 100;
  }

  if (supplierKey === "import") {
    return 3;
  }

  if (supplierKey === "meat") {
    return 8;
  }

  if (supplierKey === "produce") {
    return 6;
  }

  return 5;
}

function lotCodeFor(product, source) {
  const compactId = String(product.id).split("-")[0].toUpperCase();
  const sourceCode = source.replace(/[^A-Za-z0-9]+/g, "-").slice(0, 20).toUpperCase();
  return `START-${batchDate}-${compactId}-${sourceCode}`;
}

async function upsertVendorItem(orgId, supplierId, product, purchase) {
  const result = await client.query(
    `
      insert into vendor_items (
        organization_id,
        supplier_id,
        product_id,
        vendor_sku,
        vendor_name,
        purchase_unit_id,
        inventory_unit_id,
        purchase_to_inventory_factor,
        pack_description,
        last_price,
        last_price_currency,
        review_status
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'mapped')
      on conflict (organization_id, supplier_id, vendor_sku)
      do update set
        product_id = excluded.product_id,
        vendor_name = excluded.vendor_name,
        purchase_unit_id = excluded.purchase_unit_id,
        inventory_unit_id = excluded.inventory_unit_id,
        purchase_to_inventory_factor = excluded.purchase_to_inventory_factor,
        pack_description = excluded.pack_description,
        last_price = excluded.last_price,
        last_price_currency = excluded.last_price_currency,
        review_status = 'mapped',
        updated_at = now()
      returning id
    `,
    [
      orgId,
      supplierId,
      product.id,
      `STARTER-${product.id}`,
      product.name,
      purchase.purchaseUnitId,
      purchase.inventoryUnitId,
      purchase.purchaseToInventoryFactor,
      purchase.purchaseUnitCode === "kg" ? "1 кг" : "1 шт",
      purchase.pricePerPurchaseUnit,
      currency,
    ],
  );

  return result.rows[0].id;
}

async function insertReceivingDocument(orgId, locId, supplierId, documentNumber) {
  const result = await client.query(
    `
      insert into receiving_documents (
        organization_id,
        location_id,
        supplier_id,
        document_number,
        status,
        received_at
      )
      values ($1, $2, $3, $4, 'posted', $5::date)
      returning id
    `,
    [orgId, locId, supplierId, documentNumber, batchDate],
  );

  return result.rows[0].id;
}

async function insertReceivingLine(receivingDocumentId, vendorItemId, product, purchase) {
  const result = await client.query(
    `
      insert into receiving_lines (
        receiving_document_id,
        vendor_item_id,
        product_id,
        received_quantity,
        received_unit_id,
        base_quantity,
        base_unit_id,
        unit_cost,
        currency,
        lot_code
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      returning id
    `,
    [
      receivingDocumentId,
      vendorItemId,
      product.id,
      purchase.purchaseQuantity,
      purchase.purchaseUnitId,
      purchase.baseQuantity,
      purchase.inventoryUnitId,
      purchase.baseUnitCost,
      currency,
      purchase.lotCode,
    ],
  );

  return result.rows[0].id;
}

async function insertStockLot(orgId, locId, product, receivingLineId, purchase) {
  const result = await client.query(
    `
      insert into stock_lots (
        organization_id,
        location_id,
        product_id,
        source_receiving_line_id,
        lot_code,
        base_unit_id,
        initial_quantity,
        current_quantity,
        unit_cost,
        currency
      )
      values ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9)
      returning id
    `,
    [
      orgId,
      locId,
      product.id,
      receivingLineId,
      purchase.lotCode,
      purchase.inventoryUnitId,
      purchase.baseQuantity,
      purchase.baseUnitCost,
      currency,
    ],
  );

  return result.rows[0].id;
}

async function insertStockMovement(orgId, locId, product, stockLotId, receivingLineId, purchase) {
  await client.query(
    `
      insert into stock_movements (
        organization_id,
        location_id,
        product_id,
        stock_lot_id,
        movement_type,
        quantity_delta,
        unit_id,
        unit_cost,
        currency,
        reference_type,
        reference_id,
        reason
      )
      values ($1, $2, $3, $4, 'purchase_receipt', $5, $6, $7, $8, 'receiving_line', $9, $10)
    `,
    [
      orgId,
      locId,
      product.id,
      stockLotId,
      purchase.baseQuantity,
      purchase.inventoryUnitId,
      purchase.baseUnitCost,
      currency,
      receivingLineId,
      `Starter purchase price seed ${batchDate}; source ${purchase.source}`,
    ],
  );
}

async function insertInvoiceDocument(orgId, locId, supplierId, receivingDocumentId, documentNumber, lines) {
  const subtotal = lines.reduce((sum, line) => sum + line.purchase.lineTotal, 0);
  const result = await client.query(
    `
      insert into invoice_documents (
        organization_id,
        location_id,
        supplier_id,
        receiving_document_id,
        invoice_number,
        invoice_date,
        status,
        source,
        subtotal,
        tax_total,
        total,
        currency,
        raw_payload
      )
      values ($1, $2, $3, $4, $5, $6::date, 'approved', 'manual', $7, 0, $7, $8, $9::jsonb)
      returning id
    `,
    [
      orgId,
      locId,
      supplierId,
      receivingDocumentId,
      `INV-${documentNumber}`,
      batchDate,
      subtotal,
      currency,
      JSON.stringify({
        seed: "starter-purchases",
        batchDate,
        sources,
        importFormula: {
          usdToTmt,
          logisticsPercent,
          multiplier: importedMultiplier,
        },
      }),
    ],
  );

  return result.rows[0].id;
}

async function insertInvoiceLine(invoiceDocumentId, line) {
  const result = await client.query(
    `
      insert into invoice_lines (
        invoice_document_id,
        receiving_line_id,
        vendor_item_id,
        product_id,
        raw_name,
        invoiced_quantity,
        invoiced_unit_id,
        unit_price,
        line_total,
        tax_total,
        review_status
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 'approved')
      returning id
    `,
    [
      invoiceDocumentId,
      line.receivingLineId,
      line.vendorItemId,
      line.product.id,
      line.product.name,
      line.purchase.purchaseQuantity,
      line.purchase.purchaseUnitId,
      line.purchase.pricePerPurchaseUnit,
      line.purchase.lineTotal,
    ],
  );

  return result.rows[0].id;
}

async function insertPriceHistory(orgId, supplierId, line, invoiceLineId) {
  await client.query(
    `
      insert into supplier_price_history (
        organization_id,
        supplier_id,
        vendor_item_id,
        product_id,
        unit_id,
        unit_price,
        currency,
        observed_at,
        source_invoice_line_id,
        source_receiving_line_id
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10)
    `,
    [
      orgId,
      supplierId,
      line.vendorItemId,
      line.product.id,
      line.purchase.purchaseUnitId,
      line.purchase.pricePerPurchaseUnit,
      currency,
      batchDate,
      invoiceLineId,
      line.receivingLineId,
    ],
  );
}
