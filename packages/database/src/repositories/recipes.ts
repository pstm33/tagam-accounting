import type { DatabasePool } from "../client.js";

const recipeTypes = ["menu_item", "sub_recipe", "prep_item", "bar_item", "pour", "modifier_delta"];

export type RecipeVersionRecord = {
  recipeId: string;
  recipeVersionId: string;
  recipeName: string;
  recipeType: string;
  outputProductId: string | null;
  versionCode: string;
  status: string;
  yieldQuantity: string;
  yieldUnitId: string;
  targetFoodCostPercent: string | null;
  menuPrice: string | null;
  currency: string | null;
};

export type CreateRecipeInput = {
  organizationId: string;
  name: string;
  recipeType?: string;
  outputProductId?: string;
  yieldQuantity: number;
  yieldUnitId: string;
  targetFoodCostPercent?: number;
  menuPrice?: number;
  currency?: string;
};

export async function listRecipeVersions(
  pool: DatabasePool,
  organizationId: string,
  options: { status?: string; limit?: number } = {},
): Promise<RecipeVersionRecord[]> {
  const limit = Math.min(options.limit ?? 50, 500);
  const status = options.status?.trim();
  const params: unknown[] = [organizationId, limit];
  const statusClause = status ? "and rv.status = $3" : "";

  if (status) {
    params.push(status);
  }

  const result = await pool.query<RecipeVersionRecord>(
    `
      select
        r.id as "recipeId",
        rv.id as "recipeVersionId",
        r.name as "recipeName",
        r.recipe_type as "recipeType",
        r.output_product_id as "outputProductId",
        rv.version_code as "versionCode",
        rv.status,
        rv.yield_quantity as "yieldQuantity",
        rv.yield_unit_id as "yieldUnitId",
        rv.target_food_cost_percent as "targetFoodCostPercent",
        rv.menu_price as "menuPrice",
        rv.currency
      from recipes r
      join recipe_versions rv on rv.recipe_id = r.id
      where r.organization_id = $1
        ${statusClause}
      order by r.name, rv.effective_from desc nulls last, rv.created_at desc
      limit $2
    `,
    params,
  );

  return result.rows;
}

export async function createRecipe(pool: DatabasePool, input: CreateRecipeInput): Promise<RecipeVersionRecord> {
  validateCreateRecipeInput(input);
  await ensureUnitExists(pool, input.organizationId, input.yieldUnitId);

  if (input.outputProductId !== undefined) {
    await ensureProductExists(pool, input.organizationId, input.outputProductId);
  }

  const client = await pool.connect();

  try {
    await client.query("begin");
    const recipeResult = await client.query<{ id: string }>(
      `
        insert into recipes (
          organization_id,
          output_product_id,
          name,
          recipe_type
        )
        values ($1, $2, $3, $4)
        returning id
      `,
      [
        input.organizationId,
        input.outputProductId ?? null,
        input.name.trim(),
        input.recipeType ?? "menu_item",
      ],
    );
    const recipeId = recipeResult.rows[0]?.id;

    if (!recipeId) {
      throw new Error("Failed to create recipe");
    }

    const versionResult = await client.query<RecipeVersionRecord>(
      `
        insert into recipe_versions (
          recipe_id,
          version_code,
          status,
          yield_quantity,
          yield_unit_id,
          target_food_cost_percent,
          menu_price,
          currency
        )
        values ($1, 'v1', 'draft', $2, $3, $4, $5, $6)
        returning
          $1::uuid as "recipeId",
          id as "recipeVersionId",
          $7::text as "recipeName",
          $8::text as "recipeType",
          $9::uuid as "outputProductId",
          version_code as "versionCode",
          status,
          yield_quantity as "yieldQuantity",
          yield_unit_id as "yieldUnitId",
          target_food_cost_percent as "targetFoodCostPercent",
          menu_price as "menuPrice",
          currency
      `,
      [
        recipeId,
        input.yieldQuantity,
        input.yieldUnitId,
        input.targetFoodCostPercent ?? null,
        input.menuPrice ?? null,
        normalizeCurrency(input.currency) ?? null,
        input.name.trim(),
        input.recipeType ?? "menu_item",
        input.outputProductId ?? null,
      ],
    );
    await client.query("commit");

    const version = versionResult.rows[0];

    if (!version) {
      throw new Error("Failed to create recipe version");
    }

    return version;
  } catch (error) {
    await client.query("rollback");

    if (isUniqueViolation(error)) {
      throw new Error("Recipe name already exists");
    }

    throw error;
  } finally {
    client.release();
  }
}

function validateCreateRecipeInput(input: CreateRecipeInput): void {
  if (!input.name.trim()) {
    throw new Error("name is required");
  }

  if (input.recipeType !== undefined && !recipeTypes.includes(input.recipeType)) {
    throw new Error("recipeType must be menu_item, sub_recipe, prep_item, bar_item, pour, or modifier_delta");
  }

  if (!Number.isFinite(input.yieldQuantity) || input.yieldQuantity <= 0) {
    throw new Error("yieldQuantity must be greater than zero");
  }

  if (!input.yieldUnitId.trim()) {
    throw new Error("yieldUnitId is required");
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
}

async function ensureUnitExists(pool: DatabasePool, organizationId: string, unitId: string): Promise<void> {
  const result = await pool.query<{ id: string }>(
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

async function ensureProductExists(pool: DatabasePool, organizationId: string, productId: string): Promise<void> {
  const result = await pool.query<{ id: string }>(
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

function normalizeCurrency(currency: string | undefined): string | undefined {
  const value = currency?.trim().toUpperCase();
  return value && value.length === 3 ? value : undefined;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
