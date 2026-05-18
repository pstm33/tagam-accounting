import { bootstrapOrganization, createDatabasePool } from "./index.js";
import type { DatabasePool } from "./client.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

type IdRow = {
  id: string;
};

type UnitMap = {
  g: string;
  kg: string;
  ml: string;
  l: string;
  pcs: string;
};

const demoOrganizationName = "TAGAM Demo Restaurant";
const demoLocationName = "Ashgabat Demo Kitchen";

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pool = createDatabasePool();

  try {
    const result = await seedDemoData(pool);
    console.log(`Demo organization: ${result.organizationId}`);
    console.log(`Demo location: ${result.locationId}`);
    console.log(`Demo recipe: ${result.recipeVersionId}`);
  } finally {
    await pool.end();
  }
}

export async function seedDemoData(database: DatabasePool): Promise<{
  organizationId: string;
  locationId: string;
  recipeVersionId: string;
}> {
  const organization = await findOrganization(database, demoOrganizationName);
  const bootstrap = organization
    ? undefined
    : await bootstrapOrganization(database, {
        organizationName: demoOrganizationName,
        legalName: "TAGAM Demo Restaurant LLC",
        defaultCurrency: "TMT",
        timezone: "Asia/Ashgabat",
        locationName: demoLocationName,
        kmrsMerchantId: "demo-merchant-1",
      });
  const organizationId = organization?.id ?? bootstrap?.organization.id;

  if (!organizationId) {
    throw new Error("Failed to create or find demo organization");
  }

  const locationId =
    bootstrap?.location.id ??
    (await ensureLocation(database, organizationId, demoLocationName, "demo-merchant-1"));
  const units = await ensureUnits(database, organizationId);
  const categories = {
    meat: await ensureCategory(database, organizationId, "Сырье: мясо"),
    dairy: await ensureCategory(database, organizationId, "Сырье: молочные продукты"),
    bakery: await ensureCategory(database, organizationId, "Сырье: бакалея"),
    sauces: await ensureCategory(database, organizationId, "Сырье: соусы и специи"),
    packaging: await ensureCategory(database, organizationId, "Упаковка: доставка"),
  };
  const products = {
    beef: await ensureProduct(database, organizationId, categories.meat, units.g, "Говядина сырая", "raw"),
    bun: await ensureProduct(database, organizationId, categories.bakery, units.pcs, "Булочка для бургера", "raw"),
    cheese: await ensureProduct(database, organizationId, categories.dairy, units.g, "Сыр чеддер", "raw"),
    sauce: await ensureProduct(database, organizationId, categories.sauces, units.g, "Фирменный соус для бургера", "raw"),
    box: await ensureProduct(database, organizationId, categories.packaging, units.pcs, "Бургер-бокс", "packaging"),
  };
  const processing = {
    trimming: await ensureProcessingMethod(database, organizationId, "Зачистка говядины", "trimming"),
    frying: await ensureProcessingMethod(database, organizationId, "Жарка на плите", "frying"),
  };

  await ensureYieldRule(database, organizationId, products.beef, processing.trimming, units.g, 1000, 920, 92);
  await ensureYieldRule(database, organizationId, products.beef, processing.frying, units.g, 1000, 720, 72);

  const supplierId = await ensureSupplier(database, organizationId, "Demo Fresh Supplier");

  await ensureStockLot(database, organizationId, locationId, supplierId, products.beef, units.g, 15_000, 0.08, "TMT", "BEEF-DEMO-001");
  await ensureStockLot(database, organizationId, locationId, supplierId, products.bun, units.pcs, 100, 1.2, "TMT", "BUN-DEMO-001");
  await ensureStockLot(database, organizationId, locationId, supplierId, products.cheese, units.g, 5_000, 0.06, "TMT", "CHEESE-DEMO-001");
  await ensureStockLot(database, organizationId, locationId, supplierId, products.sauce, units.g, 3_000, 0.03, "TMT", "SAUCE-DEMO-001");
  await ensureStockLot(database, organizationId, locationId, supplierId, products.box, units.pcs, 100, 0.5, "TMT", "BOX-DEMO-001");

  const recipeId = await ensureRecipe(database, organizationId, "Классический бургер", "menu_item");
  const recipeVersionId = await ensureRecipeVersion(database, recipeId, units.pcs);
  const hasLines = await recipeHasLines(database, recipeVersionId);

  if (!hasLines) {
    await addRecipeLine(database, recipeVersionId, products.beef, 130, units.g, "prepared_output", [
      { methodId: processing.trimming, sequence: 1, yieldPercent: 92 },
      { methodId: processing.frying, sequence: 2, yieldPercent: 72 },
    ]);
    await addRecipeLine(database, recipeVersionId, products.bun, 1, units.pcs, "stock_input");
    await addRecipeLine(database, recipeVersionId, products.cheese, 25, units.g, "stock_input");
    await addRecipeLine(database, recipeVersionId, products.sauce, 20, units.g, "stock_input");
    await addRecipeLine(database, recipeVersionId, products.box, 1, units.pcs, "stock_input");
  }

  const kmrsMenuItemId = await ensureKmrsMenuItem(database, organizationId, locationId, "demo-classic-burger");
  await ensureKmrsMenuRecipeLink(database, organizationId, kmrsMenuItemId, recipeId, recipeVersionId);

  return {
    organizationId,
    locationId,
    recipeVersionId,
  };
}

async function findOrganization(database: DatabasePool, name: string): Promise<IdRow | undefined> {
  const result = await database.query<IdRow>("select id from organizations where name = $1 limit 1", [name]);
  return result.rows[0];
}

async function ensureLocation(
  database: DatabasePool,
  organizationId: string,
  name: string,
  kmrsMerchantId: string,
): Promise<string> {
  const result = await database.query<IdRow>(
    `
      insert into locations (organization_id, name, kind, kmrs_merchant_id, timezone)
      values ($1, $2, 'restaurant', $3, 'Asia/Ashgabat')
      on conflict (organization_id, name)
      do update set kmrs_merchant_id = excluded.kmrs_merchant_id
      returning id
    `,
    [organizationId, name, kmrsMerchantId],
  );

  return getId(result.rows[0], "location");
}

async function ensureUnits(database: DatabasePool, organizationId: string): Promise<UnitMap> {
  const result = await database.query<{ id: string; code: keyof UnitMap }>(
    "select id, code from units where organization_id = $1 and code in ('g', 'kg', 'ml', 'l', 'pcs')",
    [organizationId],
  );
  const units = Object.fromEntries(result.rows.map((row) => [row.code, row.id])) as Partial<UnitMap>;

  for (const code of ["g", "kg", "ml", "l", "pcs"] as const) {
    if (!units[code]) {
      throw new Error(`Missing unit ${code}; run bootstrap first`);
    }
  }

  return units as UnitMap;
}

async function ensureCategory(database: DatabasePool, organizationId: string, name: string): Promise<string> {
  const result = await database.query<IdRow>(
    `
      insert into product_categories (organization_id, name)
      values ($1, $2)
      on conflict (organization_id, name)
      do update set name = excluded.name
      returning id
    `,
    [organizationId, name],
  );

  return getId(result.rows[0], "category");
}

async function ensureProduct(
  database: DatabasePool,
  organizationId: string,
  categoryId: string,
  baseUnitId: string,
  name: string,
  productType: string,
): Promise<string> {
  const result = await database.query<IdRow>(
    `
      insert into products (organization_id, category_id, base_unit_id, name, product_type)
      values ($1, $2, $3, $4, $5)
      on conflict (organization_id, name)
      do update set category_id = excluded.category_id, base_unit_id = excluded.base_unit_id
      returning id
    `,
    [organizationId, categoryId, baseUnitId, name, productType],
  );

  return getId(result.rows[0], "product");
}

async function ensureProcessingMethod(
  database: DatabasePool,
  organizationId: string,
  name: string,
  kind: string,
): Promise<string> {
  const result = await database.query<IdRow>(
    `
      insert into processing_methods (organization_id, name, kind)
      values ($1, $2, $3)
      on conflict (organization_id, name)
      do update set kind = excluded.kind
      returning id
    `,
    [organizationId, name, kind],
  );

  return getId(result.rows[0], "processing method");
}

async function ensureYieldRule(
  database: DatabasePool,
  organizationId: string,
  productId: string,
  processingMethodId: string,
  unitId: string,
  inputQuantity: number,
  outputQuantity: number,
  yieldPercent: number,
): Promise<void> {
  const existing = await database.query<IdRow>(
    "select id from product_yield_rules where product_id = $1 and processing_method_id = $2 limit 1",
    [productId, processingMethodId],
  );

  if (existing.rows[0]) {
    return;
  }

  await database.query(
    `
      insert into product_yield_rules (
        organization_id,
        product_id,
        processing_method_id,
        input_quantity,
        input_unit_id,
        output_quantity,
        output_unit_id,
        yield_percent
      )
      values ($1, $2, $3, $4, $5, $6, $5, $7)
    `,
    [organizationId, productId, processingMethodId, inputQuantity, unitId, outputQuantity, yieldPercent],
  );
}

async function ensureSupplier(database: DatabasePool, organizationId: string, name: string): Promise<string> {
  const result = await database.query<IdRow>(
    `
      insert into suppliers (organization_id, name, payment_terms)
      values ($1, $2, 'demo')
      on conflict (organization_id, name)
      do update set payment_terms = excluded.payment_terms
      returning id
    `,
    [organizationId, name],
  );

  return getId(result.rows[0], "supplier");
}

async function ensureStockLot(
  database: DatabasePool,
  organizationId: string,
  locationId: string,
  supplierId: string,
  productId: string,
  unitId: string,
  quantity: number,
  unitCost: number,
  currency: string,
  lotCode: string,
): Promise<void> {
  const existing = await database.query<IdRow>(
    "select id from stock_lots where organization_id = $1 and lot_code = $2 limit 1",
    [organizationId, lotCode],
  );

  if (existing.rows[0]) {
    return;
  }

  const receivingDocument = await database.query<IdRow>(
    `
      insert into receiving_documents (organization_id, location_id, supplier_id, document_number, status)
      values ($1, $2, $3, $4, 'posted')
      returning id
    `,
    [organizationId, locationId, supplierId, `RCV-${lotCode}`],
  );
  const receivingDocumentId = getId(receivingDocument.rows[0], "receiving document");
  const receivingLine = await database.query<IdRow>(
    `
      insert into receiving_lines (
        receiving_document_id,
        product_id,
        received_quantity,
        received_unit_id,
        base_quantity,
        base_unit_id,
        unit_cost,
        currency,
        lot_code
      )
      values ($1, $2, $3, $4, $3, $4, $5, $6, $7)
      returning id
    `,
    [receivingDocumentId, productId, quantity, unitId, unitCost, currency, lotCode],
  );
  const receivingLineId = getId(receivingLine.rows[0], "receiving line");
  const stockLot = await database.query<IdRow>(
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
    [organizationId, locationId, productId, receivingLineId, lotCode, unitId, quantity, unitCost, currency],
  );

  await database.query(
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
        reference_id
      )
      values ($1, $2, $3, $4, 'purchase_receipt', $5, $6, $7, $8, 'receiving_line', $9)
    `,
    [
      organizationId,
      locationId,
      productId,
      getId(stockLot.rows[0], "stock lot"),
      quantity,
      unitId,
      unitCost,
      currency,
      receivingLineId,
    ],
  );
}

async function ensureRecipe(
  database: DatabasePool,
  organizationId: string,
  name: string,
  recipeType: string,
): Promise<string> {
  const result = await database.query<IdRow>(
    `
      insert into recipes (organization_id, name, recipe_type)
      values ($1, $2, $3)
      on conflict (organization_id, name)
      do update set recipe_type = excluded.recipe_type
      returning id
    `,
    [organizationId, name, recipeType],
  );

  return getId(result.rows[0], "recipe");
}

async function ensureRecipeVersion(database: DatabasePool, recipeId: string, unitId: string): Promise<string> {
  const result = await database.query<IdRow>(
    `
      insert into recipe_versions (
        recipe_id,
        version_code,
        status,
        effective_from,
        yield_quantity,
        yield_unit_id,
        servings,
        target_food_cost_percent,
        menu_price,
        currency,
        instructions
      )
      values ($1, 'v1', 'active', now(), 1, $2, 1, 32, 45, 'TMT', 'Демо-техкарта классического бургера.')
      on conflict (recipe_id, version_code)
      do update set status = 'active', menu_price = excluded.menu_price
      returning id
    `,
    [recipeId, unitId],
  );

  return getId(result.rows[0], "recipe version");
}

async function recipeHasLines(database: DatabasePool, recipeVersionId: string): Promise<boolean> {
  const result = await database.query<{ count: string }>(
    "select count(*) as count from recipe_lines where recipe_version_id = $1",
    [recipeVersionId],
  );

  return Number(result.rows[0]?.count ?? 0) > 0;
}

async function addRecipeLine(
  database: DatabasePool,
  recipeVersionId: string,
  productId: string,
  quantity: number,
  unitId: string,
  quantityMode: "stock_input" | "prepared_output",
  processing: Array<{ methodId: string; sequence: number; yieldPercent: number }> = [],
): Promise<void> {
  const line = await database.query<IdRow>(
    `
      insert into recipe_lines (
        recipe_version_id,
        ingredient_product_id,
        quantity,
        unit_id,
        quantity_mode
      )
      values ($1, $2, $3, $4, $5)
      returning id
    `,
    [recipeVersionId, productId, quantity, unitId, quantityMode],
  );
  const lineId = getId(line.rows[0], "recipe line");

  for (const item of processing) {
    await database.query(
      `
        insert into recipe_line_processing (
          recipe_line_id,
          processing_method_id,
          sequence_number,
          yield_percent
        )
        values ($1, $2, $3, $4)
      `,
      [lineId, item.methodId, item.sequence, item.yieldPercent],
    );
  }
}

async function ensureKmrsMenuItem(
  database: DatabasePool,
  organizationId: string,
  locationId: string,
  kmrsItemId: string,
): Promise<string> {
  const existing = await database.query<IdRow>(
    "select id from kmrs_menu_items where organization_id = $1 and kmrs_item_id = $2 limit 1",
    [organizationId, kmrsItemId],
  );

  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const result = await database.query<IdRow>(
    `
      insert into kmrs_menu_items (
        organization_id,
        location_id,
        kmrs_item_id,
        name,
        description,
        price,
        currency,
        is_available
      )
  values ($1, $2, $3, 'Классический бургер', 'Демо-позиция KMRS, импортированная в учетный модуль.', 45, 'TMT', true)
      returning id
    `,
    [organizationId, locationId, kmrsItemId],
  );

  return getId(result.rows[0], "KMRS menu item");
}

async function ensureKmrsMenuRecipeLink(
  database: DatabasePool,
  organizationId: string,
  kmrsMenuItemId: string,
  recipeId: string,
  recipeVersionId: string,
): Promise<void> {
  const existing = await database.query<IdRow>(
    "select id from kmrs_menu_recipe_links where kmrs_menu_item_id = $1 and recipe_id = $2 limit 1",
    [kmrsMenuItemId, recipeId],
  );

  if (existing.rows[0]) {
    return;
  }

  await database.query(
    `
      insert into kmrs_menu_recipe_links (
        organization_id,
        kmrs_menu_item_id,
        recipe_id,
        active_recipe_version_id,
        status
      )
      values ($1, $2, $3, $4, 'active')
    `,
    [organizationId, kmrsMenuItemId, recipeId, recipeVersionId],
  );
}

function getId(row: IdRow | undefined, label: string): string {
  if (!row) {
    throw new Error(`Failed to create or load ${label}`);
  }

  return row.id;
}
