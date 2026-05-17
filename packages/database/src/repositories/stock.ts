import type { DatabasePool } from "../client.js";

export type InventorySummaryRow = {
  productId: string;
  productName: string;
  locationId: string;
  locationName: string;
  unitId: string;
  quantityOnHand: string;
  inventoryValue: string;
  currency: string;
};

export async function getInventorySummary(
  pool: DatabasePool,
  organizationId: string,
  options: { locationId?: string; limit?: number } = {},
): Promise<InventorySummaryRow[]> {
  const limit = Math.min(options.limit ?? 100, 500);
  const params: unknown[] = [organizationId, limit];
  const locationClause = options.locationId ? "and sl.location_id = $3" : "";

  if (options.locationId) {
    params.push(options.locationId);
  }

  const result = await pool.query<InventorySummaryRow>(
    `
      select
        p.id as "productId",
        p.name as "productName",
        l.id as "locationId",
        l.name as "locationName",
        sl.base_unit_id as "unitId",
        sum(sl.current_quantity) as "quantityOnHand",
        sum(sl.current_quantity * sl.unit_cost) as "inventoryValue",
        sl.currency
      from stock_lots sl
      join products p on p.id = sl.product_id
      join locations l on l.id = sl.location_id
      where sl.organization_id = $1
        and sl.status = 'active'
        ${locationClause}
      group by p.id, p.name, l.id, l.name, sl.base_unit_id, sl.currency
      order by p.name
      limit $2
    `,
    params,
  );

  return result.rows;
}
