import type { DatabasePool } from "../client.js";

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
  const limit = Math.min(options.limit ?? 50, 200);
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
  const result = await pool.query<ProductRecord>(
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
      input.name,
      input.sku ?? null,
      input.productType ?? "raw",
      input.inventoryPolicy ?? "tracked",
      input.defaultWastePercent ?? 0,
    ],
  );

  const product = result.rows[0];
  if (!product) {
    throw new Error("Failed to create product");
  }

  return product;
}
