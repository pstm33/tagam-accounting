import type { DatabasePool } from "../client.js";

export type OrganizationRecord = {
  id: string;
  name: string;
  legalName: string | null;
  defaultCurrency: string;
  timezone: string;
  status: string;
  locationCount: number;
  productCount: number;
  recipeCount: number;
};

export type LocationRecord = {
  id: string;
  organizationId: string;
  name: string;
  kind: string;
  kmrsMerchantId: string | null;
  timezone: string | null;
  isActive: boolean;
};

export type UnitRecord = {
  id: string;
  organizationId: string | null;
  code: string;
  name: string;
  measureType: string;
  isBase: boolean;
};

export type ProductCategoryRecord = {
  id: string;
  organizationId: string;
  parentId: string | null;
  name: string;
  accountingCode: string | null;
};

export type CreateProductCategoryInput = {
  organizationId: string;
  name: string;
  parentId?: string;
  accountingCode?: string;
};

export type ProcessingMethodRecord = {
  id: string;
  organizationId: string;
  name: string;
  kind: string;
};

export type DemoSummaryRecord = {
  organization: OrganizationRecord;
  primaryLocation: LocationRecord | null;
  activeRecipeVersionId: string | null;
  health: {
    products: number;
    activeRecipes: number;
    inventoryRows: number;
    linkedKmrsItems: number;
  };
};

export async function listOrganizations(pool: DatabasePool): Promise<OrganizationRecord[]> {
  const result = await pool.query<OrganizationRecord>(
    `
      select
        o.id,
        o.name,
        o.legal_name as "legalName",
        o.default_currency as "defaultCurrency",
        o.timezone,
        o.status,
        (select count(*)::int from locations l where l.organization_id = o.id) as "locationCount",
        (select count(*)::int from products p where p.organization_id = o.id) as "productCount",
        (select count(*)::int from recipes r where r.organization_id = o.id) as "recipeCount"
      from organizations o
      order by o.created_at desc
    `,
  );

  return result.rows;
}

export async function listLocations(pool: DatabasePool, organizationId: string): Promise<LocationRecord[]> {
  const result = await pool.query<LocationRecord>(
    `
      select
        id,
        organization_id as "organizationId",
        name,
        kind,
        kmrs_merchant_id as "kmrsMerchantId",
        timezone,
        is_active as "isActive"
      from locations
      where organization_id = $1
      order by is_active desc, name
    `,
    [organizationId],
  );

  return result.rows;
}

export async function listUnits(pool: DatabasePool, organizationId: string): Promise<UnitRecord[]> {
  const result = await pool.query<UnitRecord>(
    `
      select
        id,
        organization_id as "organizationId",
        code,
        name,
        measure_type as "measureType",
        is_base as "isBase"
      from units
      where organization_id = $1
      order by measure_type, code
    `,
    [organizationId],
  );

  return result.rows;
}

export async function listProductCategories(
  pool: DatabasePool,
  organizationId: string,
): Promise<ProductCategoryRecord[]> {
  const result = await pool.query<ProductCategoryRecord>(
    `
      select
        id,
        organization_id as "organizationId",
        parent_id as "parentId",
        name,
        accounting_code as "accountingCode"
      from product_categories
      where organization_id = $1
      order by name
    `,
    [organizationId],
  );

  return result.rows;
}

export async function createProductCategory(
  pool: DatabasePool,
  input: CreateProductCategoryInput,
): Promise<ProductCategoryRecord> {
  const name = input.name.trim();

  if (!name) {
    throw new Error("name is required");
  }

  if (input.parentId !== undefined) {
    await ensureProductCategoryExists(pool, input.organizationId, input.parentId);
  }

  try {
    const result = await pool.query<ProductCategoryRecord>(
      `
        insert into product_categories (
          organization_id,
          parent_id,
          name,
          accounting_code
        )
        values ($1, $2, $3, $4)
        returning
          id,
          organization_id as "organizationId",
          parent_id as "parentId",
          name,
          accounting_code as "accountingCode"
      `,
      [
        input.organizationId,
        input.parentId ?? null,
        name,
        input.accountingCode?.trim() || null,
      ],
    );

    const category = result.rows[0];

    if (!category) {
      throw new Error("Failed to create product category");
    }

    return category;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Product category name already exists");
    }

    throw error;
  }
}

export async function listProcessingMethods(
  pool: DatabasePool,
  organizationId: string,
): Promise<ProcessingMethodRecord[]> {
  const result = await pool.query<ProcessingMethodRecord>(
    `
      select
        id,
        organization_id as "organizationId",
        name,
        kind
      from processing_methods
      where organization_id = $1
      order by kind, name
    `,
    [organizationId],
  );

  return result.rows;
}

async function ensureProductCategoryExists(pool: DatabasePool, organizationId: string, categoryId: string): Promise<void> {
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
    throw new Error("Product category was not found");
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

export async function getDemoSummary(pool: DatabasePool): Promise<DemoSummaryRecord | null> {
  const organizations = await listOrganizations(pool);
  const organization = organizations.find((item) => item.name === "TAGAM Demo Restaurant") ?? organizations[0];

  if (!organization) {
    return null;
  }

  const locations = await listLocations(pool, organization.id);
  const primaryLocation = locations[0] ?? null;
  const activeRecipeResult = await pool.query<{ id: string }>(
    `
      select rv.id
      from recipes r
      join recipe_versions rv on rv.recipe_id = r.id
      where r.organization_id = $1
        and rv.status = 'active'
      order by rv.effective_from desc nulls last, rv.created_at desc
      limit 1
    `,
    [organization.id],
  );
  const healthResult = await pool.query<{
    products: number;
    activeRecipes: number;
    inventoryRows: number;
    linkedKmrsItems: number;
  }>(
    `
      select
        (select count(*)::int from products where organization_id = $1) as "products",
        (
          select count(*)::int
          from recipes r
          join recipe_versions rv on rv.recipe_id = r.id
          where r.organization_id = $1 and rv.status = 'active'
        ) as "activeRecipes",
        (
          select count(*)::int
          from stock_lots
          where organization_id = $1 and status = 'active' and current_quantity > 0
        ) as "inventoryRows",
        (
          select count(*)::int
          from kmrs_menu_recipe_links
          where organization_id = $1 and status = 'active'
        ) as "linkedKmrsItems"
    `,
    [organization.id],
  );

  return {
    organization,
    primaryLocation,
    activeRecipeVersionId: activeRecipeResult.rows[0]?.id ?? null,
    health: healthResult.rows[0] ?? {
      products: 0,
      activeRecipes: 0,
      inventoryRows: 0,
      linkedKmrsItems: 0,
    },
  };
}
