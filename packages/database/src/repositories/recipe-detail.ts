import type { DatabasePool } from "../client.js";

export type RecipeLineProcessingRecord = {
  id: string;
  name: string;
  kind: string;
  sequenceNumber: number;
  yieldPercent: string;
};

export type RecipeCostLineRecord = {
  recipeLineId: string;
  productId: string;
  productName: string;
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
  costStatus: "ok" | "missing_cost" | "missing_conversion";
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
  foodCostPercent: number | null;
  grossMargin: number | null;
  recommendedMenuPrice: number | null;
  lines: RecipeCostLineRecord[];
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
  productId: string;
  productName: string;
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

export async function getRecipeCostDetail(
  pool: DatabasePool,
  organizationId: string,
  recipeVersionId: string,
  options: { locationId?: string } = {},
): Promise<RecipeCostDetailRecord | null> {
  const headerResult = await pool.query<RecipeHeaderRow>(
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
  const header = headerResult.rows[0];

  if (!header) {
    return null;
  }

  const lineResult = await pool.query<RecipeLineRow>(
    `
      select
        rl.id as "recipeLineId",
        p.id as "productId",
        p.name as "productName",
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
          when cost.unit_id is null then null
          when cost.unit_id = rl.unit_id then 1
          else coalesce(product_conversion.factor, global_conversion.factor)
        end as "conversionFactor"
      from recipe_lines rl
      join recipe_versions rv on rv.id = rl.recipe_version_id
      join recipes r on r.id = rv.recipe_id
      join products p on p.id = rl.ingredient_product_id
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
      ) cost on true
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
        line_unit.code,
        cost.unit_id,
        cost.unit_code,
        cost.unit_cost,
        cost.currency,
        product_conversion.factor,
        global_conversion.factor
      order by rl.sort_order, p.name
    `,
    [organizationId, recipeVersionId, options.locationId ?? null],
  );
  const lines = lineResult.rows.map(costLine);
  const complete = lines.every((line) => line.costStatus === "ok" && line.lineCost !== null);
  const totalCost = complete
    ? lines.reduce((sum, line) => sum + (line.lineCost ?? 0), 0)
    : null;
  const yieldQuantity = toNumber(header.yieldQuantity);
  const costPerYieldUnit = totalCost === null ? null : totalCost / yieldQuantity;
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

  return {
    ...header,
    currency: header.currency ?? lines[0]?.currency ?? "TMT",
    costingStatus: complete ? "complete" : "incomplete",
    totalCost,
    costPerYieldUnit,
    foodCostPercent,
    grossMargin,
    recommendedMenuPrice,
    lines,
  };
}

function costLine(row: RecipeLineRow): RecipeCostLineRecord {
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
  const unitCost = toNullableNumber(row.unitCost);
  const conversionFactor = toNullableNumber(row.conversionFactor);
  const costQuantity = conversionFactor === null ? null : stockInputQuantity * conversionFactor;
  const lineCost = unitCost === null || costQuantity === null ? null : unitCost * costQuantity;
  const costStatus =
    unitCost === null ? "missing_cost" : conversionFactor === null ? "missing_conversion" : "ok";

  return {
    recipeLineId: row.recipeLineId,
    productId: row.productId,
    productName: row.productName,
    quantity: row.quantity,
    unitId: row.unitId,
    unitCode: row.unitCode,
    quantityMode: row.quantityMode,
    extraWastePercent: row.extraWastePercent,
    processing,
    effectiveYieldPercent: effectiveYieldFactor * 100,
    stockInputQuantity,
    preparedOutputQuantity,
    processingDeltaQuantity: stockInputQuantity - preparedOutputQuantity,
    costQuantity,
    costUnitId: row.costUnitId,
    costUnitCode: row.costUnitCode,
    unitCost,
    lineCost,
    currency: row.currency,
    costStatus,
  };
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
