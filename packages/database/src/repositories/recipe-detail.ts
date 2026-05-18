import type { DatabasePool } from "../client.js";

export type RecipeLineProcessingRecord = {
  id: string;
  name: string;
  kind: string;
  sequenceNumber: number;
  yieldPercent: string;
};

export type RecipeCostStatus =
  | "ok"
  | "missing_cost"
  | "missing_conversion"
  | "missing_child_cost"
  | "cycle_detected";

export type RecipeCostRequirementRecord = {
  recipeLineId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitId: string;
  unitCode: string;
  estimatedCost: number;
  unitCost: number;
  currency: string;
  effectiveYieldPercent: number;
};

export type RecipeFulfillmentMode = "dine_in" | "delivery";

export type RecipeCostLineRecord = {
  recipeLineId: string;
  lineKind: "product" | "recipe";
  productId: string | null;
  productName: string;
  productType: string | null;
  fulfillmentMode: "base" | "delivery_packaging";
  childRecipeVersionId: string | null;
  childRecipeName: string | null;
  childRecipeVersionCode: string | null;
  quantity: string;
  unitId: string;
  unitCode: string;
  quantityMode: string;
  extraWastePercent: string;
  processing: RecipeLineProcessingRecord[];
  effectiveYieldPercent: number;
  stockInputQuantity: number;
  preparedOutputQuantity: number;
  processingDeltaQuantity: number;
  costQuantity: number | null;
  costUnitId: string | null;
  costUnitCode: string | null;
  unitCost: number | null;
  lineCost: number | null;
  currency: string | null;
  costStatus: RecipeCostStatus;
  requirements: RecipeCostRequirementRecord[];
};

export type RecipeCostDetailRecord = {
  recipeId: string;
  recipeVersionId: string;
  recipeName: string;
  recipeType: string;
  versionCode: string;
  status: string;
  yieldQuantity: string;
  yieldUnitId: string;
  yieldUnitCode: string;
  servings: string;
  targetFoodCostPercent: string | null;
  menuPrice: string | null;
  currency: string;
  instructions: string | null;
  costingStatus: "complete" | "incomplete";
  totalCost: number | null;
  costPerYieldUnit: number | null;
  dineInTotalCost: number | null;
  dineInCostPerYieldUnit: number | null;
  deliveryPackagingCost: number | null;
  deliveryTotalCost: number | null;
  deliveryCostPerYieldUnit: number | null;
  fulfillmentMode: RecipeFulfillmentMode;
  foodCostPercent: number | null;
  grossMargin: number | null;
  recommendedMenuPrice: number | null;
  lines: RecipeCostLineRecord[];
  requirements: RecipeCostRequirementRecord[];
};

type RecipeHeaderRow = {
  recipeId: string;
  recipeVersionId: string;
  recipeName: string;
  recipeType: string;
  versionCode: string;
  status: string;
  yieldQuantity: string;
  yieldUnitId: string;
  yieldUnitCode: string;
  servings: string;
  targetFoodCostPercent: string | null;
  menuPrice: string | null;
  currency: string | null;
  instructions: string | null;
};

type RecipeLineRow = {
  recipeLineId: string;
  productId: string | null;
  productName: string | null;
  productType: string | null;
  childRecipeVersionId: string | null;
  childRecipeName: string | null;
  childRecipeVersionCode: string | null;
  childRecipeType: string | null;
  childYieldQuantity: string | null;
  childYieldUnitId: string | null;
  childYieldUnitCode: string | null;
  childOutputProductId: string | null;
  quantity: string;
  unitId: string;
  unitCode: string;
  quantityMode: string;
  extraWastePercent: string;
  processing: unknown;
  costUnitId: string | null;
  costUnitCode: string | null;
  unitCost: string | null;
  currency: string | null;
  conversionFactor: string | null;
};

type QuantityResult = {
  processing: RecipeLineProcessingRecord[];
  effectiveYieldFactor: number;
  stockInputQuantity: number;
  preparedOutputQuantity: number;
};

export async function getRecipeCostDetail(
  pool: DatabasePool,
  organizationId: string,
  recipeVersionId: string,
  options: { locationId?: string; fulfillmentMode?: RecipeFulfillmentMode } = {},
): Promise<RecipeCostDetailRecord | null> {
  return getRecipeCostDetailInternal(pool, organizationId, recipeVersionId, options, []);
}

async function getRecipeCostDetailInternal(
  pool: DatabasePool,
  organizationId: string,
  recipeVersionId: string,
  options: { locationId?: string; fulfillmentMode?: RecipeFulfillmentMode },
  stack: string[],
): Promise<RecipeCostDetailRecord | null> {
  if (stack.includes(recipeVersionId)) {
    return null;
  }

  const header = await getHeader(pool, organizationId, recipeVersionId);

  if (!header) {
    return null;
  }

  const rows = await getRows(pool, organizationId, recipeVersionId, options.locationId);
  const nextStack = [...stack, recipeVersionId];
  const lines: RecipeCostLineRecord[] = [];

  for (const row of rows) {
    lines.push(
      row.childRecipeVersionId
        ? await childRecipeLine(pool, organizationId, row, options, nextStack)
        : productCostLine(row),
    );
  }

  const fulfillmentMode = normalizeFulfillmentMode(options.fulfillmentMode);
  const dineInLines = lines.filter((line) => line.fulfillmentMode !== "delivery_packaging");
  const deliveryLines = lines;
  const includedLines = fulfillmentMode === "delivery" ? deliveryLines : dineInLines;
  const complete =
    includedLines.length > 0 && includedLines.every((line) => line.costStatus === "ok" && line.lineCost !== null);
  const dineInComplete =
    dineInLines.length > 0 && dineInLines.every((line) => line.costStatus === "ok" && line.lineCost !== null);
  const deliveryComplete =
    deliveryLines.length > 0 && deliveryLines.every((line) => line.costStatus === "ok" && line.lineCost !== null);
  const packagingLines = lines.filter((line) => line.fulfillmentMode === "delivery_packaging");
  const packagingComplete = packagingLines.every((line) => line.costStatus === "ok" && line.lineCost !== null);
  const totalCost = complete ? sumLineCost(includedLines) : null;
  const dineInTotalCost = dineInComplete ? sumLineCost(dineInLines) : null;
  const deliveryPackagingCost = packagingComplete ? sumLineCost(packagingLines) : null;
  const deliveryTotalCost = deliveryComplete ? sumLineCost(deliveryLines) : null;
  const yieldQuantity = toNumber(header.yieldQuantity);
  const costPerYieldUnit = totalCost === null ? null : totalCost / yieldQuantity;
  const dineInCostPerYieldUnit = dineInTotalCost === null ? null : dineInTotalCost / yieldQuantity;
  const deliveryCostPerYieldUnit = deliveryTotalCost === null ? null : deliveryTotalCost / yieldQuantity;
  const menuPrice = toNullableNumber(header.menuPrice);
  const targetFoodCostPercent = toNullableNumber(header.targetFoodCostPercent);
  const foodCostPercent =
    costPerYieldUnit !== null && menuPrice !== null && menuPrice > 0
      ? (costPerYieldUnit / menuPrice) * 100
      : null;
  const grossMargin = costPerYieldUnit !== null && menuPrice !== null ? menuPrice - costPerYieldUnit : null;
  const recommendedMenuPrice =
    costPerYieldUnit !== null && targetFoodCostPercent !== null && targetFoodCostPercent > 0
      ? costPerYieldUnit / (targetFoodCostPercent / 100)
      : null;
  const requirements = complete ? aggregateRequirements(includedLines.flatMap((line) => line.requirements)) : [];

  return {
    ...header,
    currency: header.currency ?? lines.find((line) => line.currency !== null)?.currency ?? "TMT",
    costingStatus: complete ? "complete" : "incomplete",
    totalCost,
    costPerYieldUnit,
    dineInTotalCost,
    dineInCostPerYieldUnit,
    deliveryPackagingCost,
    deliveryTotalCost,
    deliveryCostPerYieldUnit,
    fulfillmentMode,
    foodCostPercent,
    grossMargin,
    recommendedMenuPrice,
    lines,
    requirements,
  };
}

async function getHeader(
  pool: DatabasePool,
  organizationId: string,
  recipeVersionId: string,
): Promise<RecipeHeaderRow | null> {
  const result = await pool.query<RecipeHeaderRow>(
    `
      select
        r.id as "recipeId",
        rv.id as "recipeVersionId",
        r.name as "recipeName",
        r.recipe_type as "recipeType",
        rv.version_code as "versionCode",
        rv.status,
        rv.yield_quantity as "yieldQuantity",
        rv.yield_unit_id as "yieldUnitId",
        yu.code as "yieldUnitCode",
        rv.servings,
        rv.target_food_cost_percent as "targetFoodCostPercent",
        rv.menu_price as "menuPrice",
        rv.currency,
        rv.instructions
      from recipe_versions rv
      join recipes r on r.id = rv.recipe_id
      join units yu on yu.id = rv.yield_unit_id
      where r.organization_id = $1
        and rv.id = $2
      limit 1
    `,
    [organizationId, recipeVersionId],
  );

  return result.rows[0] ?? null;
}

async function getRows(
  pool: DatabasePool,
  organizationId: string,
  recipeVersionId: string,
  locationId: string | undefined,
): Promise<RecipeLineRow[]> {
  const result = await pool.query<RecipeLineRow>(
    `
      select
        rl.id as "recipeLineId",
        p.id as "productId",
        p.name as "productName",
        p.product_type as "productType",
        child_rv.id as "childRecipeVersionId",
        child_r.name as "childRecipeName",
        child_rv.version_code as "childRecipeVersionCode",
        child_r.recipe_type as "childRecipeType",
        child_rv.yield_quantity as "childYieldQuantity",
        child_rv.yield_unit_id as "childYieldUnitId",
        child_yu.code as "childYieldUnitCode",
        child_r.output_product_id as "childOutputProductId",
        rl.quantity,
        rl.unit_id as "unitId",
        line_unit.code as "unitCode",
        rl.quantity_mode as "quantityMode",
        rl.extra_waste_percent as "extraWastePercent",
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', pm.id,
              'name', pm.name,
              'kind', pm.kind,
              'sequenceNumber', rlp.sequence_number,
              'yieldPercent', rlp.yield_percent
            )
            order by rlp.sequence_number
          ) filter (where rlp.id is not null),
          '[]'::jsonb
        ) as processing,
        cost.unit_id as "costUnitId",
        cost.unit_code as "costUnitCode",
        cost.unit_cost as "unitCost",
        cost.currency,
        case
          when p.id is null then null
          when cost.unit_id is null then null
          when cost.unit_id = rl.unit_id then 1
          else coalesce(product_conversion.factor, global_conversion.factor)
        end as "conversionFactor"
      from recipe_lines rl
      join recipe_versions rv on rv.id = rl.recipe_version_id
      join recipes r on r.id = rv.recipe_id
      left join products p on p.id = rl.ingredient_product_id
      left join recipe_versions child_rv on child_rv.id = rl.child_recipe_version_id
      left join recipes child_r on child_r.id = child_rv.recipe_id
      left join units child_yu on child_yu.id = child_rv.yield_unit_id
      join units line_unit on line_unit.id = rl.unit_id
      left join recipe_line_processing rlp on rlp.recipe_line_id = rl.id
      left join processing_methods pm on pm.id = rlp.processing_method_id
      left join lateral (
        select
          sl.base_unit_id as unit_id,
          cost_unit.code as unit_code,
          (sum(sl.current_quantity * sl.unit_cost) / nullif(sum(sl.current_quantity), 0)) as unit_cost,
          min(sl.currency) as currency
        from stock_lots sl
        join units cost_unit on cost_unit.id = sl.base_unit_id
        where sl.organization_id = r.organization_id
          and sl.product_id = p.id
          and sl.status = 'active'
          and sl.current_quantity > 0
          and ($3::uuid is null or sl.location_id = $3::uuid)
        group by sl.base_unit_id, cost_unit.code
        order by sum(sl.current_quantity) desc
        limit 1
      ) cost on p.id is not null
      left join unit_conversions product_conversion
        on product_conversion.organization_id = r.organization_id
        and product_conversion.product_id = p.id
        and product_conversion.from_unit_id = rl.unit_id
        and product_conversion.to_unit_id = cost.unit_id
      left join unit_conversions global_conversion
        on global_conversion.organization_id = r.organization_id
        and global_conversion.product_id is null
        and global_conversion.from_unit_id = rl.unit_id
        and global_conversion.to_unit_id = cost.unit_id
      where r.organization_id = $1
        and rv.id = $2
      group by
        rl.id,
        p.id,
        p.name,
        p.product_type,
        child_rv.id,
        child_r.name,
        child_rv.version_code,
        child_r.recipe_type,
        child_rv.yield_quantity,
        child_rv.yield_unit_id,
        child_yu.code,
        child_r.output_product_id,
        line_unit.code,
        cost.unit_id,
        cost.unit_code,
        cost.unit_cost,
        cost.currency,
        product_conversion.factor,
        global_conversion.factor
      order by rl.sort_order, coalesce(p.name, child_r.name)
    `,
    [organizationId, recipeVersionId, locationId ?? null],
  );

  return result.rows;
}

function productCostLine(row: RecipeLineRow): RecipeCostLineRecord {
  const quantities = lineQuantities(row);
  const unitCost = toNullableNumber(row.unitCost);
  const conversionFactor = toNullableNumber(row.conversionFactor);
  const costQuantity = conversionFactor === null ? null : quantities.stockInputQuantity * conversionFactor;
  const lineCost = unitCost === null || costQuantity === null ? null : unitCost * costQuantity;
  const costStatus: RecipeCostStatus =
    unitCost === null ? "missing_cost" : conversionFactor === null ? "missing_conversion" : "ok";
  const requirements =
    costStatus === "ok" &&
    row.productId !== null &&
    row.costUnitId !== null &&
    row.costUnitCode !== null &&
    row.currency !== null &&
    costQuantity !== null &&
    unitCost !== null &&
    lineCost !== null
      ? [
          {
            recipeLineId: row.recipeLineId,
            productId: row.productId,
            productName: row.productName ?? "Product",
            quantity: costQuantity,
            unitId: row.costUnitId,
            unitCode: row.costUnitCode,
            estimatedCost: lineCost,
            unitCost,
            currency: row.currency,
            effectiveYieldPercent: quantities.effectiveYieldFactor * 100,
          },
        ]
      : [];

  return {
    recipeLineId: row.recipeLineId,
    lineKind: "product",
    productId: row.productId,
    productName: row.productName ?? "Product",
    productType: row.productType,
    fulfillmentMode: row.productType === "packaging" ? "delivery_packaging" : "base",
    childRecipeVersionId: null,
    childRecipeName: null,
    childRecipeVersionCode: null,
    quantity: row.quantity,
    unitId: row.unitId,
    unitCode: row.unitCode,
    quantityMode: row.quantityMode,
    extraWastePercent: row.extraWastePercent,
    processing: quantities.processing,
    effectiveYieldPercent: quantities.effectiveYieldFactor * 100,
    stockInputQuantity: quantities.stockInputQuantity,
    preparedOutputQuantity: quantities.preparedOutputQuantity,
    processingDeltaQuantity: quantities.stockInputQuantity - quantities.preparedOutputQuantity,
    costQuantity,
    costUnitId: row.costUnitId,
    costUnitCode: row.costUnitCode,
    unitCost,
    lineCost,
    currency: row.currency,
    costStatus,
    requirements,
  };
}

async function childRecipeLine(
  pool: DatabasePool,
  organizationId: string,
  row: RecipeLineRow,
  options: { locationId?: string },
  stack: string[],
): Promise<RecipeCostLineRecord> {
  const quantities = lineQuantities(row);
  const baseLine = {
    recipeLineId: row.recipeLineId,
    lineKind: "recipe" as const,
    productId: row.childOutputProductId,
    productName: row.childRecipeName ?? "Recipe",
    productType: null,
    fulfillmentMode: "base" as const,
    childRecipeVersionId: row.childRecipeVersionId,
    childRecipeName: row.childRecipeName,
    childRecipeVersionCode: row.childRecipeVersionCode,
    quantity: row.quantity,
    unitId: row.unitId,
    unitCode: row.unitCode,
    quantityMode: row.quantityMode,
    extraWastePercent: row.extraWastePercent,
    processing: quantities.processing,
    effectiveYieldPercent: quantities.effectiveYieldFactor * 100,
    stockInputQuantity: quantities.stockInputQuantity,
    preparedOutputQuantity: quantities.preparedOutputQuantity,
    processingDeltaQuantity: quantities.stockInputQuantity - quantities.preparedOutputQuantity,
  };

  if (!row.childRecipeVersionId || !row.childYieldQuantity || !row.childYieldUnitId || !row.childYieldUnitCode) {
    return incompleteChildLine(baseLine, "missing_child_cost");
  }

  if (stack.includes(row.childRecipeVersionId)) {
    return incompleteChildLine(baseLine, "cycle_detected");
  }

  const child = await getRecipeCostDetailInternal(pool, organizationId, row.childRecipeVersionId, options, stack);

  if (!child || child.totalCost === null || child.costPerYieldUnit === null || child.costingStatus !== "complete") {
    return incompleteChildLine(baseLine, "missing_child_cost", child?.currency ?? null);
  }

  const conversionFactor = await findConversionFactor(
    pool,
    organizationId,
    row.childOutputProductId,
    row.unitId,
    row.childYieldUnitId,
  );

  if (conversionFactor === null) {
    return incompleteChildLine(baseLine, "missing_conversion", child.currency);
  }

  const childOutputQuantity = quantities.stockInputQuantity * conversionFactor;
  const childYieldQuantity = toNumber(row.childYieldQuantity);
  const scale = childOutputQuantity / childYieldQuantity;
  const lineCost = child.totalCost * scale;
  const requirements = child.requirements.map((requirement) => ({
    ...requirement,
    quantity: requirement.quantity * scale,
    estimatedCost: requirement.estimatedCost * scale,
  }));

  return {
    ...baseLine,
    costQuantity: childOutputQuantity,
    costUnitId: row.childYieldUnitId,
    costUnitCode: row.childYieldUnitCode,
    unitCost: child.costPerYieldUnit,
    lineCost,
    currency: child.currency,
    costStatus: "ok",
    requirements,
  };
}

function incompleteChildLine(
  baseLine: Omit<
    RecipeCostLineRecord,
    "costQuantity" | "costUnitId" | "costUnitCode" | "unitCost" | "lineCost" | "currency" | "costStatus" | "requirements"
  >,
  costStatus: RecipeCostStatus,
  currency: string | null = null,
): RecipeCostLineRecord {
  return {
    ...baseLine,
    costQuantity: null,
    costUnitId: null,
    costUnitCode: null,
    unitCost: null,
    lineCost: null,
    currency,
    costStatus,
    requirements: [],
  };
}

function normalizeFulfillmentMode(value: RecipeFulfillmentMode | undefined): RecipeFulfillmentMode {
  return value === "delivery" ? "delivery" : "dine_in";
}

function sumLineCost(lines: RecipeCostLineRecord[]): number {
  return lines.reduce((sum, line) => sum + (line.lineCost ?? 0), 0);
}

function lineQuantities(row: Pick<RecipeLineRow, "processing" | "quantity" | "quantityMode" | "extraWastePercent">): QuantityResult {
  const processing = parseProcessing(row.processing);
  const quantity = toNumber(row.quantity);
  const extraWasteFactor = 1 + toNumber(row.extraWastePercent) / 100;
  const effectiveYieldFactor = processing.reduce(
    (factor, item) => factor * (toNumber(item.yieldPercent) / 100),
    1,
  );
  const stockInputBeforeWaste =
    row.quantityMode === "prepared_output" ? quantity / effectiveYieldFactor : quantity;
  const stockInputQuantity = stockInputBeforeWaste * extraWasteFactor;
  const preparedOutputQuantity =
    row.quantityMode === "prepared_output" ? quantity : quantity * effectiveYieldFactor;

  return {
    processing,
    effectiveYieldFactor,
    stockInputQuantity,
    preparedOutputQuantity,
  };
}

async function findConversionFactor(
  pool: DatabasePool,
  organizationId: string,
  productId: string | null,
  fromUnitId: string,
  toUnitId: string,
): Promise<number | null> {
  if (fromUnitId === toUnitId) {
    return 1;
  }

  const result = await pool.query<{ factor: string }>(
    `
      select coalesce(product_conversion.factor, global_conversion.factor) as factor
      from (select 1) seed
      left join unit_conversions product_conversion
        on product_conversion.organization_id = $1
        and product_conversion.product_id = $2
        and product_conversion.from_unit_id = $3
        and product_conversion.to_unit_id = $4
      left join unit_conversions global_conversion
        on global_conversion.organization_id = $1
        and global_conversion.product_id is null
        and global_conversion.from_unit_id = $3
        and global_conversion.to_unit_id = $4
      limit 1
    `,
    [organizationId, productId, fromUnitId, toUnitId],
  );

  return toNullableNumber(result.rows[0]?.factor ?? null);
}

function aggregateRequirements(requirements: RecipeCostRequirementRecord[]): RecipeCostRequirementRecord[] {
  const byProductUnit = new Map<string, RecipeCostRequirementRecord>();

  for (const requirement of requirements) {
    const key = `${requirement.productId}:${requirement.unitId}:${requirement.currency}`;
    const existing = byProductUnit.get(key);

    if (!existing) {
      byProductUnit.set(key, { ...requirement });
      continue;
    }

    existing.quantity += requirement.quantity;
    existing.estimatedCost += requirement.estimatedCost;
    existing.unitCost = existing.estimatedCost / existing.quantity;
  }

  return [...byProductUnit.values()];
}

function parseProcessing(value: unknown): RecipeLineProcessingRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item) => ({
      id: String(item.id),
      name: String(item.name),
      kind: String(item.kind),
      sequenceNumber: Number(item.sequenceNumber),
      yieldPercent: String(item.yieldPercent),
    }));
}

function toNumber(value: string | number): number {
  return typeof value === "number" ? value : Number.parseFloat(value);
}

function toNullableNumber(value: string | number | null): number | null {
  if (value === null) {
    return null;
  }

  return toNumber(value);
}
