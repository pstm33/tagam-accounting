import type { DatabasePool } from "../client.js";

export type KmrsMenuImportItem = {
  kmrsItemId: string;
  kmrsCategoryId?: string;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  isAvailable?: boolean;
  rawPayload?: unknown;
};

export type KmrsMenuImportInput = {
  organizationId: string;
  locationId: string;
  baseUrl: string;
  kmrsMerchantId: string;
  restaurantSlug?: string;
  items: KmrsMenuImportItem[];
  rawPayload?: unknown;
};

export type KmrsMenuImportResult = {
  kmrsConnectionId: string;
  syncRunId: string;
  importedCount: number;
  skippedCount: number;
};

export type KmrsImportedMenuItemRecord = {
  id: string;
  organizationId: string;
  locationId: string | null;
  kmrsConnectionId: string | null;
  kmrsItemId: string;
  kmrsCategoryId: string | null;
  name: string;
  description: string | null;
  price: string | null;
  currency: string | null;
  isAvailable: boolean | null;
  importedAt: string;
  linkStatus: string | null;
  activeRecipeVersionId: string | null;
  recipeName: string | null;
};

type IdRow = {
  id: string;
};

export async function importKmrsMenuSnapshot(
  pool: DatabasePool,
  input: KmrsMenuImportInput,
): Promise<KmrsMenuImportResult> {
  const validItems = input.items.filter((item) => item.kmrsItemId?.trim() && item.name?.trim());
  const connectionId = await ensureKmrsConnection(pool, input);
  const syncRun = await pool.query<IdRow>(
    `
      insert into kmrs_sync_runs (
        organization_id,
        kmrs_connection_id,
        sync_type,
        status,
        metadata
      )
      values ($1, $2, 'menu_import', 'running', $3::jsonb)
      returning id
    `,
    [
      input.organizationId,
      connectionId,
      JSON.stringify({
        baseUrl: input.baseUrl,
        kmrsMerchantId: input.kmrsMerchantId,
        restaurantSlug: input.restaurantSlug ?? null,
        receivedCount: input.items.length,
      }),
    ],
  );
  const syncRunId = getId(syncRun.rows[0], "KMRS sync run");
  let importedCount = 0;

  try {
    for (const item of validItems) {
      await pool.query(
        `
          insert into kmrs_menu_items (
            organization_id,
            location_id,
            kmrs_connection_id,
            kmrs_item_id,
            kmrs_category_id,
            name,
            description,
            price,
            currency,
            is_available,
            raw_payload,
            imported_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, now())
          on conflict (organization_id, kmrs_connection_id, kmrs_item_id)
          do update set
            location_id = excluded.location_id,
            kmrs_category_id = excluded.kmrs_category_id,
            name = excluded.name,
            description = excluded.description,
            price = excluded.price,
            currency = excluded.currency,
            is_available = excluded.is_available,
            raw_payload = excluded.raw_payload,
            imported_at = now()
        `,
        [
          input.organizationId,
          input.locationId,
          connectionId,
          item.kmrsItemId.trim(),
          item.kmrsCategoryId ?? null,
          item.name.trim(),
          item.description ?? null,
          item.price ?? null,
          item.currency ?? null,
          item.isAvailable ?? null,
          JSON.stringify(item.rawPayload ?? item),
        ],
      );
      importedCount += 1;
    }

    await pool.query(
      `
        update kmrs_sync_runs
        set
          status = 'succeeded',
          finished_at = now(),
          imported_count = $1,
          metadata = metadata || $2::jsonb
        where id = $3
      `,
      [
        importedCount,
        JSON.stringify({
          skippedCount: input.items.length - validItems.length,
        }),
        syncRunId,
      ],
    );
  } catch (error) {
    await pool.query(
      `
        update kmrs_sync_runs
        set
          status = 'failed',
          finished_at = now(),
          imported_count = $1,
          error_message = $2
        where id = $3
      `,
      [importedCount, error instanceof Error ? error.message : "Unknown import error", syncRunId],
    );
    throw error;
  }

  return {
    kmrsConnectionId: connectionId,
    syncRunId,
    importedCount,
    skippedCount: input.items.length - validItems.length,
  };
}

export async function listKmrsImportedMenuItems(
  pool: DatabasePool,
  organizationId: string,
  options: { locationId?: string; kmrsConnectionId?: string; limit?: number } = {},
): Promise<KmrsImportedMenuItemRecord[]> {
  const limit = Math.min(options.limit ?? 100, 500);
  const params: unknown[] = [organizationId, limit];
  const clauses = ["kmi.organization_id = $1"];

  if (options.locationId) {
    params.push(options.locationId);
    clauses.push(`kmi.location_id = $${params.length}`);
  }

  if (options.kmrsConnectionId) {
    params.push(options.kmrsConnectionId);
    clauses.push(`kmi.kmrs_connection_id = $${params.length}`);
  }

  const result = await pool.query<KmrsImportedMenuItemRecord>(
    `
      select
        kmi.id,
        kmi.organization_id as "organizationId",
        kmi.location_id as "locationId",
        kmi.kmrs_connection_id as "kmrsConnectionId",
        kmi.kmrs_item_id as "kmrsItemId",
        kmi.kmrs_category_id as "kmrsCategoryId",
        kmi.name,
        kmi.description,
        kmi.price,
        kmi.currency,
        kmi.is_available as "isAvailable",
        kmi.imported_at as "importedAt",
        link.status as "linkStatus",
        link.active_recipe_version_id as "activeRecipeVersionId",
        r.name as "recipeName"
      from kmrs_menu_items kmi
      left join kmrs_menu_recipe_links link on link.kmrs_menu_item_id = kmi.id
      left join recipes r on r.id = link.recipe_id
      where ${clauses.join(" and ")}
      order by kmi.imported_at desc, kmi.name
      limit $2
    `,
    params,
  );

  return result.rows;
}

async function ensureKmrsConnection(pool: DatabasePool, input: KmrsMenuImportInput): Promise<string> {
  const existing = await pool.query<IdRow>(
    `
      select id
      from kmrs_connections
      where organization_id = $1
        and location_id = $2
        and base_url = $3
        and kmrs_merchant_id = $4
        and status <> 'archived'
      order by created_at desc
      limit 1
    `,
    [input.organizationId, input.locationId, input.baseUrl, input.kmrsMerchantId],
  );

  if (existing.rows[0]) {
    await pool.query(
      "update kmrs_connections set last_sync_at = now(), status = 'active' where id = $1",
      [existing.rows[0].id],
    );
    return existing.rows[0].id;
  }

  const created = await pool.query<IdRow>(
    `
      insert into kmrs_connections (
        organization_id,
        location_id,
        base_url,
        kmrs_merchant_id,
        auth_mode,
        status,
        last_sync_at
      )
      values ($1, $2, $3, $4, 'manual', 'active', now())
      returning id
    `,
    [input.organizationId, input.locationId, input.baseUrl, input.kmrsMerchantId],
  );

  return getId(created.rows[0], "KMRS connection");
}

function getId(row: IdRow | undefined, label: string): string {
  if (!row) {
    throw new Error(`Failed to create ${label}`);
  }

  return row.id;
}
