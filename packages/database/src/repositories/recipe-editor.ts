import type { DatabaseClient, DatabasePool } from "../client.js";

export type RecipeVersionUpdateInput = {
  organizationId: string;
  recipeVersionId: string;
  yieldQuantity?: number;
  yieldUnitId?: string;
  targetFoodCostPercent?: number;
  menuPrice?: number;
  currency?: string;
  instructions?: string;
  status?: "draft" | "active" | "archived";
};

export type RecipeLineInput = {
  organizationId: string;
  recipeVersionId: string;
  ingredientProductId: string;
  quantity: number;
  unitId: string;
  quantityMode?: "stock_input" | "prepared_output";
  extraWastePercent?: number;
  note?: string;
};

export type RecipeMutationResult = {
  id: string;
};

type IdRow = {
  id: string;
};

export async function updateRecipeVersion(
  pool: DatabasePool,
  input: RecipeVersionUpdateInput,
): Promise<RecipeMutationResult> {
  validateRecipeVersionUpdate(input);

  if (input.status === "active") {
    const lineCount = await countRecipeLines(pool, input.organizationId, input.recipeVersionId);

    if (lineCount === 0) {
      throw new Error("Recipe version must contain at least one ingredient before activation");
    }
  }

  const result = await pool.query<IdRow>(
    `
      update recipe_versions rv
      set
        yield_quantity = coalesce($3, rv.yield_quantity),
        yield_unit_id = coalesce($4, rv.yield_unit_id),
        target_food_cost_percent = coalesce($5, rv.target_food_cost_percent),
        menu_price = coalesce($6, rv.menu_price),
        currency = coalesce($7, rv.currency),
        instructions = coalesce($8, rv.instructions),
        status = coalesce($9, rv.status),
        effective_from = case
          when $9 = 'active' then coalesce(rv.effective_from, now())
          else rv.effective_from
        end,
        updated_at = now()
      from recipes r
      where r.id = rv.recipe_id
        and r.organization_id = $1
        and rv.id = $2
      returning rv.id
    `,
    [
      input.organizationId,
      input.recipeVersionId,
      input.yieldQuantity ?? null,
      input.yieldUnitId ?? null,
      input.targetFoodCostPercent ?? null,
      input.menuPrice ?? null,
      normalizeCurrency(input.currency) ?? null,
      input.instructions?.trim() ?? null,
      input.status ?? null,
    ],
  );

  return getMutation(result.rows[0], "Recipe version was not found");
}

export async function addRecipeLine(
  pool: DatabasePool,
  input: RecipeLineInput,
): Promise<RecipeMutationResult> {
  validateRecipeLineInput(input);
  const client = await pool.connect();

  try {
    await client.query("begin");
    await ensureRecipeVersionExists(client, input.organizationId, input.recipeVersionId);
    await ensureProductExists(client, input.organizationId, input.ingredientProductId);
    await ensureUnitExists(client, input.organizationId, input.unitId);
    const result = await client.query<IdRow>(
      `
        insert into recipe_lines (
          recipe_version_id,
          ingredient_product_id,
          quantity,
          unit_id,
          quantity_mode,
          extra_waste_percent,
          sort_order,
          note
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          coalesce((select max(sort_order) + 10 from recipe_lines where recipe_version_id = $1), 10),
          $7
        )
        returning id
      `,
      [
        input.recipeVersionId,
        input.ingredientProductId,
        input.quantity,
        input.unitId,
        input.quantityMode ?? "stock_input",
        input.extraWastePercent ?? 0,
        input.note?.trim() ?? null,
      ],
    );
    await client.query("commit");
    return getMutation(result.rows[0], "Failed to create recipe line");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteRecipeLine(
  pool: DatabasePool,
  input: { organizationId: string; recipeVersionId: string; recipeLineId: string },
): Promise<RecipeMutationResult> {
  const result = await pool.query<IdRow>(
    `
      delete from recipe_lines rl
      using recipe_versions rv, recipes r
      where rl.recipe_version_id = rv.id
        and rv.recipe_id = r.id
        and r.organization_id = $1
        and rv.id = $2
        and rl.id = $3
      returning rl.id
    `,
    [input.organizationId, input.recipeVersionId, input.recipeLineId],
  );

  return getMutation(result.rows[0], "Recipe line was not found");
}

async function countRecipeLines(pool: DatabasePool, organizationId: string, recipeVersionId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `
      select count(*) as count
      from recipe_lines rl
      join recipe_versions rv on rv.id = rl.recipe_version_id
      join recipes r on r.id = rv.recipe_id
      where r.organization_id = $1
        and rv.id = $2
    `,
    [organizationId, recipeVersionId],
  );

  return Number(result.rows[0]?.count ?? 0);
}

async function ensureRecipeVersionExists(
  client: DatabaseClient,
  organizationId: string,
  recipeVersionId: string,
): Promise<void> {
  const result = await client.query<IdRow>(
    `
      select rv.id
      from recipe_versions rv
      join recipes r on r.id = rv.recipe_id
      where r.organization_id = $1
        and rv.id = $2
      limit 1
    `,
    [organizationId, recipeVersionId],
  );

  if (!result.rows[0]) {
    throw new Error("Recipe version was not found");
  }
}

async function ensureProductExists(client: DatabaseClient, organizationId: string, productId: string): Promise<void> {
  const result = await client.query<IdRow>(
    `
      select id
      from products
      where organization_id = $1
        and id = $2
        and is_active = true
      limit 1
    `,
    [organizationId, productId],
  );

  if (!result.rows[0]) {
    throw new Error("Product was not found");
  }
}

async function ensureUnitExists(client: DatabaseClient, organizationId: string, unitId: string): Promise<void> {
  const result = await client.query<IdRow>(
    `
      select id
      from units
      where organization_id = $1
        and id = $2
      limit 1
    `,
    [organizationId, unitId],
  );

  if (!result.rows[0]) {
    throw new Error("Unit was not found");
  }
}

function validateRecipeVersionUpdate(input: RecipeVersionUpdateInput): void {
  if (input.yieldQuantity !== undefined && (!Number.isFinite(input.yieldQuantity) || input.yieldQuantity <= 0)) {
    throw new Error("yieldQuantity must be greater than zero");
  }

  if (
    input.targetFoodCostPercent !== undefined &&
    (!Number.isFinite(input.targetFoodCostPercent) || input.targetFoodCostPercent <= 0)
  ) {
    throw new Error("targetFoodCostPercent must be greater than zero");
  }

  if (input.menuPrice !== undefined && (!Number.isFinite(input.menuPrice) || input.menuPrice < 0)) {
    throw new Error("menuPrice must be zero or greater");
  }

  if (input.status !== undefined && !["draft", "active", "archived"].includes(input.status)) {
    throw new Error("status must be draft, active, or archived");
  }
}

function validateRecipeLineInput(input: RecipeLineInput): void {
  if (!input.ingredientProductId) {
    throw new Error("ingredientProductId is required");
  }

  if (!input.unitId) {
    throw new Error("unitId is required");
  }

  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("quantity must be greater than zero");
  }

  if (input.extraWastePercent !== undefined && (!Number.isFinite(input.extraWastePercent) || input.extraWastePercent < 0)) {
    throw new Error("extraWastePercent must be zero or greater");
  }

  if (input.quantityMode !== undefined && !["stock_input", "prepared_output"].includes(input.quantityMode)) {
    throw new Error("quantityMode must be stock_input or prepared_output");
  }
}

function normalizeCurrency(currency: string | undefined): string | undefined {
  const value = currency?.trim().toUpperCase();
  return value && value.length === 3 ? value : undefined;
}

function getMutation(row: IdRow | undefined, message: string): RecipeMutationResult {
  if (!row) {
    throw new Error(message);
  }

  return { id: row.id };
}
