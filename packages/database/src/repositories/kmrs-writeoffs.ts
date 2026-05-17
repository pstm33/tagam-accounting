import type { DatabasePool } from "../client.js";
import { getRecipeCostDetail } from "./recipe-detail.js";

export type KmrsSaleLineInput = {
  kmrsItemId: string;
  name?: string;
  quantity: number;
  salePrice?: number;
  currency?: string;
  rawPayload?: unknown;
};

export type KmrsSaleWriteoffInput = {
  organizationId: string;
  locationId: string;
  kmrsOrderId?: string;
  orderedAt?: string;
  status?: string;
  paymentStatus?: string;
  lines: KmrsSaleLineInput[];
  rawPayload?: unknown;
};

export type KmrsSaleWriteoffRequirement = {
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
  availabilityStatus: "ok" | "shortage";
  availableQuantity: number;
  shortageQuantity: number;
};

export type KmrsSaleWriteoffLine = {
  lineIndex: number;
  kmrsItemId: string;
  name: string;
  quantity: number;
  salePrice: number | null;
  currency: string;
  recipeVersionId: string;
  recipeName: string;
  recipeCostPerUnit: number;
  theoreticalCost: number;
  foodCostPercent: number | null;
  requirements: KmrsSaleWriteoffRequirement[];
};

export type KmrsSaleWriteoffPreview = {
  organizationId: string;
  locationId: string;
  kmrsOrderId: string | null;
  status: "preview";
  costingStatus: "complete" | "incomplete";
  availabilityStatus: "ok" | "shortage";
  totals: {
    saleTotal: number | null;
    theoreticalCost: number;
    grossMargin: number | null;
    foodCostPercent: number | null;
    currency: string;
  };
  lines: KmrsSaleWriteoffLine[];
  requirements: KmrsSaleWriteoffRequirement[];
  warnings: string[];
};

export type CommittedStockMovement = {
  stockMovementId: string;
  productId: string;
  productName: string;
  stockLotId: string;
  quantity: number;
  unitId: string;
  unitCode: string;
  unitCost: number;
  cost: number;
  currency: string;
};

export type KmrsSaleWriteoffCommit = Omit<KmrsSaleWriteoffPreview, "status"> & {
  status: "committed";
  kmrsOrderDatabaseId: string;
  orderWriteoffId: string;
  stockMovements: CommittedStockMovement[];
};

type MenuRecipeMapping = {
  kmrsMenuItemId: string;
  kmrsItemId: string;
  menuName: string;
  menuPrice: string | null;
  menuCurrency: string | null;
  recipeVersionId: string;
  recipeName: string;
};

type StockAvailabilityRow = {
  productId: string;
  unitId: string;
  availableQuantity: string;
};

type IdRow = {
  id: string;
};

type StockLotRow = {
  id: string;
  currentQuantity: string;
  unitCost: string;
  currency: string;
};

const epsilon = 0.000001;

export async function previewKmrsSaleWriteoff(
  pool: DatabasePool,
  input: KmrsSaleWriteoffInput,
): Promise<KmrsSaleWriteoffPreview> {
  const validatedLines = validateLines(input.lines);
  const warnings: string[] = [];
  const lines: KmrsSaleWriteoffLine[] = [];

  for (const [lineIndex, saleLine] of validatedLines.entries()) {
    const mapping = await findMenuRecipe(pool, input.organizationId, input.locationId, saleLine.kmrsItemId);

    if (!mapping) {
      warnings.push(`KMRS item ${saleLine.kmrsItemId} is not linked to an active recipe`);
      continue;
    }

    const recipe = await getRecipeCostDetail(pool, input.organizationId, mapping.recipeVersionId, {
      locationId: input.locationId,
    });

    if (!recipe) {
      warnings.push(`Recipe version ${mapping.recipeVersionId} was not found`);
      continue;
    }

    const salePrice = saleLine.salePrice ?? toNullableNumber(mapping.menuPrice);
    const currency = saleLine.currency ?? mapping.menuCurrency ?? recipe.currency;
    const theoreticalCost = (recipe.costPerYieldUnit ?? 0) * saleLine.quantity;
    const requirements: KmrsSaleWriteoffRequirement[] = [];

    for (const costLine of recipe.lines) {
      if (
        costLine.costStatus !== "ok" ||
        costLine.costQuantity === null ||
        costLine.costUnitId === null ||
        costLine.costUnitCode === null ||
        costLine.unitCost === null ||
        costLine.lineCost === null ||
        costLine.currency === null
      ) {
        warnings.push(`${recipe.recipeName}: ${costLine.productName} has ${costLine.costStatus}`);
        continue;
      }

      requirements.push({
        recipeLineId: costLine.recipeLineId,
        productId: costLine.productId,
        productName: costLine.productName,
        quantity: costLine.costQuantity * saleLine.quantity,
        unitId: costLine.costUnitId,
        unitCode: costLine.costUnitCode,
        estimatedCost: costLine.lineCost * saleLine.quantity,
        unitCost: costLine.unitCost,
        currency: costLine.currency,
        effectiveYieldPercent: costLine.effectiveYieldPercent,
        availabilityStatus: "ok",
        availableQuantity: 0,
        shortageQuantity: 0,
      });
    }

    lines.push({
      lineIndex,
      kmrsItemId: saleLine.kmrsItemId,
      name: saleLine.name ?? mapping.menuName,
      quantity: saleLine.quantity,
      salePrice,
      currency,
      recipeVersionId: recipe.recipeVersionId,
      recipeName: recipe.recipeName,
      recipeCostPerUnit: recipe.costPerYieldUnit ?? 0,
      theoreticalCost,
      foodCostPercent:
        salePrice !== null && salePrice > 0 && recipe.costPerYieldUnit !== null
          ? (recipe.costPerYieldUnit / salePrice) * 100
          : null,
      requirements,
    });
  }

  await hydrateAvailability(pool, input.organizationId, input.locationId, lines);

  const requirements = aggregateRequirements(lines);
  const theoreticalCost = requirements.reduce((sum, item) => sum + item.estimatedCost, 0);
  const pricedLines = lines.filter((line) => line.salePrice !== null);
  const saleTotal =
    pricedLines.length === lines.length
      ? pricedLines.reduce((sum, line) => sum + (line.salePrice ?? 0) * line.quantity, 0)
      : null;
  const grossMargin = saleTotal === null ? null : saleTotal - theoreticalCost;
  const currency = lines[0]?.currency ?? "TMT";
  const availabilityStatus = requirements.some((item) => item.availabilityStatus === "shortage")
    ? "shortage"
    : "ok";
  const costingStatus = warnings.length > 0 || lines.length !== validatedLines.length ? "incomplete" : "complete";

  return {
    organizationId: input.organizationId,
    locationId: input.locationId,
    kmrsOrderId: input.kmrsOrderId ?? null,
    status: "preview",
    costingStatus,
    availabilityStatus,
    totals: {
      saleTotal,
      theoreticalCost,
      grossMargin,
      foodCostPercent: saleTotal !== null && saleTotal > 0 ? (theoreticalCost / saleTotal) * 100 : null,
      currency,
    },
    lines,
    requirements,
    warnings,
  };
}

export async function commitKmrsSaleWriteoff(
  pool: DatabasePool,
  input: KmrsSaleWriteoffInput,
): Promise<KmrsSaleWriteoffCommit> {
  if (!input.kmrsOrderId?.trim()) {
    throw new Error("kmrsOrderId is required for commit");
  }

  const preview = await previewKmrsSaleWriteoff(pool, input);

  if (preview.costingStatus !== "complete") {
    throw new Error("Cannot commit writeoff while costingStatus is incomplete");
  }

  if (preview.availabilityStatus !== "ok") {
    throw new Error("Cannot commit writeoff because inventory has shortages");
  }

  const client = await pool.connect();

  try {
    await client.query("begin");

    const existing = await client.query<IdRow>(
      `
        select ow.id
        from kmrs_orders ko
        join order_writeoffs ow on ow.kmrs_order_id = ko.id
        where ko.organization_id = $1
          and ko.kmrs_order_id = $2
          and ow.status = 'committed'
        limit 1
      `,
      [input.organizationId, input.kmrsOrderId],
    );

    if (existing.rows[0]) {
      throw new Error(`KMRS order ${input.kmrsOrderId} already has a committed writeoff`);
    }

    const order = await client.query<IdRow>(
      `
        insert into kmrs_orders (
          organization_id,
          location_id,
          kmrs_order_id,
          status,
          payment_status,
          ordered_at,
          raw_payload
        )
        values ($1, $2, $3, $4, $5, coalesce($6::timestamptz, now()), $7::jsonb)
        returning id
      `,
      [
        input.organizationId,
        input.locationId,
        input.kmrsOrderId,
        input.status ?? "completed",
        input.paymentStatus ?? "paid",
        input.orderedAt ?? null,
        JSON.stringify(input.rawPayload ?? input),
      ],
    );
    const kmrsOrderDatabaseId = getId(order.rows[0], "KMRS order");
    const orderLineIds = new Map<number, string>();

    for (const line of preview.lines) {
      const insertedLine = await client.query<IdRow>(
        `
          insert into kmrs_order_lines (
            kmrs_order_id,
            kmrs_item_id,
            name,
            quantity,
            sale_price,
            currency,
            mapped_recipe_version_id,
            raw_payload
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
          returning id
        `,
        [
          kmrsOrderDatabaseId,
          line.kmrsItemId,
          line.name,
          line.quantity,
          line.salePrice,
          line.currency,
          line.recipeVersionId,
          JSON.stringify(input.lines[line.lineIndex]?.rawPayload ?? input.lines[line.lineIndex] ?? {}),
        ],
      );
      orderLineIds.set(line.lineIndex, getId(insertedLine.rows[0], "KMRS order line"));
    }

    const writeoff = await client.query<IdRow>(
      `
        insert into order_writeoffs (
          organization_id,
          location_id,
          kmrs_order_id,
          status,
          reservation_at,
          committed_at
        )
        values ($1, $2, $3, 'committed', now(), now())
        returning id
      `,
      [input.organizationId, input.locationId, kmrsOrderDatabaseId],
    );
    const orderWriteoffId = getId(writeoff.rows[0], "order writeoff");
    const stockMovements: CommittedStockMovement[] = [];

    for (const line of preview.lines) {
      const kmrsOrderLineId = orderLineIds.get(line.lineIndex);

      if (!kmrsOrderLineId) {
        throw new Error(`Missing database order line for KMRS line ${line.lineIndex}`);
      }

      for (const requirement of line.requirements) {
        const movements = await allocateRequirement(client, {
          organizationId: input.organizationId,
          locationId: input.locationId,
          orderWriteoffId,
          kmrsOrderLineId,
          recipeVersionId: line.recipeVersionId,
          requirement,
          kmrsOrderId: input.kmrsOrderId,
        });
        stockMovements.push(...movements);
      }
    }

    await client.query("commit");

    return {
      ...preview,
      status: "committed",
      kmrsOrderDatabaseId,
      orderWriteoffId,
      stockMovements,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function validateLines(lines: KmrsSaleLineInput[]): KmrsSaleLineInput[] {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("lines must contain at least one KMRS sale line");
  }

  return lines.map((line, index) => {
    if (!line.kmrsItemId?.trim()) {
      throw new Error(`lines[${index}].kmrsItemId is required`);
    }

    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new Error(`lines[${index}].quantity must be greater than zero`);
    }

    if (line.salePrice !== undefined && (!Number.isFinite(line.salePrice) || line.salePrice < 0)) {
      throw new Error(`lines[${index}].salePrice must be zero or greater`);
    }

    return {
      ...line,
      kmrsItemId: line.kmrsItemId.trim(),
    };
  });
}

async function findMenuRecipe(
  pool: DatabasePool,
  organizationId: string,
  locationId: string,
  kmrsItemId: string,
): Promise<MenuRecipeMapping | null> {
  const result = await pool.query<MenuRecipeMapping>(
    `
      select
        kmi.id as "kmrsMenuItemId",
        kmi.kmrs_item_id as "kmrsItemId",
        kmi.name as "menuName",
        kmi.price as "menuPrice",
        kmi.currency as "menuCurrency",
        link.active_recipe_version_id as "recipeVersionId",
        r.name as "recipeName"
      from kmrs_menu_items kmi
      join kmrs_menu_recipe_links link on link.kmrs_menu_item_id = kmi.id
      join recipes r on r.id = link.recipe_id
      join recipe_versions rv on rv.id = link.active_recipe_version_id
      where kmi.organization_id = $1
        and kmi.kmrs_item_id = $2
        and kmi.location_id = $3
        and kmi.is_available = true
        and link.status = 'active'
        and link.active_recipe_version_id is not null
        and rv.status = 'active'
      order by link.updated_at desc
      limit 1
    `,
    [organizationId, kmrsItemId, locationId],
  );

  return result.rows[0] ?? null;
}

async function hydrateAvailability(
  pool: DatabasePool,
  organizationId: string,
  locationId: string,
  lines: KmrsSaleWriteoffLine[],
): Promise<void> {
  const requirements = aggregateRequirements(lines);

  if (requirements.length === 0) {
    return;
  }

  const result = await pool.query<StockAvailabilityRow>(
    `
      select
        product_id as "productId",
        base_unit_id as "unitId",
        sum(current_quantity) as "availableQuantity"
      from stock_lots
      where organization_id = $1
        and location_id = $2
        and status = 'active'
        and current_quantity > 0
      group by product_id, base_unit_id
    `,
    [organizationId, locationId],
  );
  const availability = new Map(
    result.rows.map((row) => [stockKey(row.productId, row.unitId), toNumber(row.availableQuantity)]),
  );

  for (const requirement of requirements) {
    const availableQuantity = availability.get(stockKey(requirement.productId, requirement.unitId)) ?? 0;
    requirement.availableQuantity = availableQuantity;
    requirement.shortageQuantity = Math.max(requirement.quantity - availableQuantity, 0);
    requirement.availabilityStatus = requirement.shortageQuantity > epsilon ? "shortage" : "ok";
  }

  const aggregateAvailability = new Map(
    requirements.map((requirement) => [
      stockKey(requirement.productId, requirement.unitId),
      {
        availableQuantity: requirement.availableQuantity,
        shortageQuantity: requirement.shortageQuantity,
        status: requirement.availabilityStatus,
      },
    ]),
  );

  for (const line of lines) {
    for (const requirement of line.requirements) {
      const status = aggregateAvailability.get(stockKey(requirement.productId, requirement.unitId));

      if (!status) {
        continue;
      }

      requirement.availableQuantity = status.availableQuantity;
      requirement.shortageQuantity = status.shortageQuantity;
      requirement.availabilityStatus = status.status;
    }
  }
}

function aggregateRequirements(lines: KmrsSaleWriteoffLine[]): KmrsSaleWriteoffRequirement[] {
  const aggregate = new Map<string, KmrsSaleWriteoffRequirement>();

  for (const line of lines) {
    for (const requirement of line.requirements) {
      const key = [
        requirement.productId,
        requirement.unitId,
        requirement.currency,
        requirement.recipeLineId,
      ].join(":");
      const existing = aggregate.get(key);

      if (existing) {
        existing.quantity += requirement.quantity;
        existing.estimatedCost += requirement.estimatedCost;
        continue;
      }

      aggregate.set(key, {
        ...requirement,
      });
    }
  }

  return [...aggregate.values()].sort((left, right) => left.productName.localeCompare(right.productName));
}

async function allocateRequirement(
  client: { query: DatabasePool["query"] },
  input: {
    organizationId: string;
    locationId: string;
    orderWriteoffId: string;
    kmrsOrderLineId: string;
    recipeVersionId: string;
    requirement: KmrsSaleWriteoffRequirement;
    kmrsOrderId: string;
  },
): Promise<CommittedStockMovement[]> {
  const lots = await client.query<StockLotRow>(
    `
      select
        id,
        current_quantity as "currentQuantity",
        unit_cost as "unitCost",
        currency
      from stock_lots
      where organization_id = $1
        and location_id = $2
        and product_id = $3
        and base_unit_id = $4
        and status = 'active'
        and current_quantity > 0
      order by expires_on nulls last, created_at, id
      for update
    `,
    [input.organizationId, input.locationId, input.requirement.productId, input.requirement.unitId],
  );
  const movements: CommittedStockMovement[] = [];
  let remaining = input.requirement.quantity;

  for (const lot of lots.rows) {
    if (remaining <= epsilon) {
      break;
    }

    const currentQuantity = toNumber(lot.currentQuantity);
    const quantity = Math.min(currentQuantity, remaining);
    const unitCost = toNumber(lot.unitCost);
    const currency = lot.currency;

    await client.query(
      `
        update stock_lots
        set
          current_quantity = current_quantity - $1,
          status = case when current_quantity - $1 <= $2 then 'depleted' else status end
        where id = $3
      `,
      [quantity, epsilon, lot.id],
    );

    const movement = await client.query<IdRow>(
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
          reference_id,
          reason
        )
        values ($1, $2, $3, $4, 'sale_writeoff', $5, $6, $7, $8, 'order_writeoff', $9, $10)
        returning id
      `,
      [
        input.organizationId,
        input.locationId,
        input.requirement.productId,
        lot.id,
        -quantity,
        input.requirement.unitId,
        unitCost,
        currency,
        input.orderWriteoffId,
        `KMRS order ${input.kmrsOrderId}`,
      ],
    );
    const stockMovementId = getId(movement.rows[0], "stock movement");

    await client.query(
      `
        insert into order_writeoff_lines (
          order_writeoff_id,
          kmrs_order_line_id,
          recipe_version_id,
          product_id,
          stock_lot_id,
          quantity,
          unit_id,
          unit_cost,
          currency,
          stock_movement_id
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        input.orderWriteoffId,
        input.kmrsOrderLineId,
        input.recipeVersionId,
        input.requirement.productId,
        lot.id,
        quantity,
        input.requirement.unitId,
        unitCost,
        currency,
        stockMovementId,
      ],
    );

    movements.push({
      stockMovementId,
      productId: input.requirement.productId,
      productName: input.requirement.productName,
      stockLotId: lot.id,
      quantity,
      unitId: input.requirement.unitId,
      unitCode: input.requirement.unitCode,
      unitCost,
      cost: quantity * unitCost,
      currency,
    });
    remaining -= quantity;
  }

  if (remaining > epsilon) {
    throw new Error(
      `Not enough stock for ${input.requirement.productName}: missing ${remaining.toFixed(6)} ${input.requirement.unitCode}`,
    );
  }

  return movements;
}

function stockKey(productId: string, unitId: string): string {
  return `${productId}:${unitId}`;
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

function getId(row: IdRow | undefined, label: string): string {
  if (!row) {
    throw new Error(`Failed to create ${label}`);
  }

  return row.id;
}
