import type { DatabasePool } from "../client.js";

const productTypes = ["raw", "prepared", "menu_item", "bar_item", "packaging", "supply", "service"];
const inventoryPolicies = ["tracked", "not_tracked", "theoretical_only"];

export type ProductRecord = {
  id: string;
  organizationId: string;
  categoryId: string | null;
  baseUnitId: string;
  name: string;
  sku: string | null;
  productType: string;
  inventoryPolicy: string;
  defaultWastePercent: string;
  isActive: boolean;
};

export type CreateProductInput = {
  organizationId: string;
  baseUnitId: string;
  name: string;
  categoryId?: string;
  sku?: string;
  productType?: string;
  inventoryPolicy?: string;
  defaultWastePercent?: number;
};

export async function listProducts(
  pool: DatabasePool,
  organizationId: string,
  options: { limit?: number; search?: string } = {},
): Promise<ProductRecord[]> {
  const limit = Math.min(options.limit ?? 50, 500);
  const search = options.search?.trim();
  const params: unknown[] = [organizationId, limit];
  const searchClause = search ? "and p.name ilike $3" : "";

  if (search) {
    params.push(`%${search}%`);
  }

  const result = await pool.query<ProductRecord>(
    `
      select
        p.id,
        p.organization_id as "organizationId",
        p.category_id as "categoryId",
        p.base_unit_id as "baseUnitId",
        p.name,
        p.sku,
        p.product_type as "productType",
        p.inventory_policy as "inventoryPolicy",
        p.default_waste_percent as "defaultWastePercent",
        p.is_active as "isActive"
      from products p
      where p.organization_id = $1
        ${searchClause}
      order by p.name
      limit $2
    `,
    params,
  );

  return result.rows;
}

export async function createProduct(pool: DatabasePool, input: CreateProductInput): Promise<ProductRecord> {
  validateCreateProductInput(input);
  await ensureUnitExists(pool, input.organizationId, input.baseUnitId);

  if (input.categoryId !== undefined) {
    await ensureCategoryExists(pool, input.organizationId, input.categoryId);
  }

  const result = await insertProduct(pool, input);

  const product = result.rows[0];
  if (!product) {
    throw new Error("Failed to create product");
  }

  return product;
}

async function insertProduct(pool: DatabasePool, input: CreateProductInput): Promise<{ rows: ProductRecord[] }> {
  try {
    return await pool.query<ProductRecord>(
      `
        insert into products (
          organization_id,
          category_id,
          base_unit_id,
          name,
          sku,
          product_type,
          inventory_policy,
          default_waste_percent
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning
          id,
          organization_id as "organizationId",
          category_id as "categoryId",
          base_unit_id as "baseUnitId",
          name,
          sku,
          product_type as "productType",
          inventory_policy as "inventoryPolicy",
          default_waste_percent as "defaultWastePercent",
          is_active as "isActive"
      `,
      [
        input.organizationId,
        input.categoryId ?? null,
        input.baseUnitId,
        input.name.trim(),
        input.sku ?? null,
        input.productType ?? "raw",
        input.inventoryPolicy ?? "tracked",
        input.defaultWastePercent ?? 0,
      ],
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Product name already exists");
    }

    throw error;
  }
}

function validateCreateProductInput(input: CreateProductInput): void {
  if (!input.name.trim()) {
    throw new Error("name is required");
  }

  if (!input.baseUnitId.trim()) {
    throw new Error("baseUnitId is required");
  }

  if (input.productType !== undefined && !productTypes.includes(input.productType)) {
    throw new Error("productType must be raw, prepared, menu_item, bar_item, packaging, supply, or service");
  }

  if (input.inventoryPolicy !== undefined && !inventoryPolicies.includes(input.inventoryPolicy)) {
    throw new Error("inventoryPolicy must be tracked, not_tracked, or theoretical_only");
  }

  if (
    input.defaultWastePercent !== undefined &&
    (!Number.isFinite(input.defaultWastePercent) || input.defaultWastePercent < 0)
  ) {
    throw new Error("defaultWastePercent must be zero or greater");
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

async function ensureCategoryExists(pool: DatabasePool, organizationId: string, categoryId: string): Promise<void> {
  const result = await pool.query<{ id: string }>(
    `
      select id
      from product_categories
      where organization_id = $1
        and id = $2
      limit 1
    `,
    [organizationId, categoryId],
  );

  if (!result.rows[0]) {
    throw new Error("Category was not found");
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
