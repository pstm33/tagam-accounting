import type { DatabasePool } from "../client.js";

export type RecipeVersionRecord = {
  recipeId: string;
  recipeVersionId: string;
  recipeName: string;
  recipeType: string;
  versionCode: string;
  status: string;
  yieldQuantity: string;
  yieldUnitId: string;
  targetFoodCostPercent: string | null;
  menuPrice: string | null;
  currency: string | null;
};

export async function listRecipeVersions(
  pool: DatabasePool,
  organizationId: string,
  options: { status?: string; limit?: number } = {},
): Promise<RecipeVersionRecord[]> {
  const limit = Math.min(options.limit ?? 50, 200);
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
