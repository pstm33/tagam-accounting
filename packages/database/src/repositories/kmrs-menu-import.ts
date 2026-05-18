import type { DatabaseClient, DatabasePool } from "../client.js";

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
  recipeDraftsCreated: number;
  recipeDraftsUpdated: number;
  recipeDraftsSkipped: number;
};

export type KmrsImportedMenuItemRecord = {
  id: string;
  organizationId: string;
  locationId: string | null;
  kmrsConnectionId: string | null;
  kmrsItemId: string;
  kmrsCategoryId: string | null;
  kmrsCategoryName: string | null;
  name: string;
  description: string | null;
  price: string | null;
  currency: string | null;
  isAvailable: boolean | null;
  importedAt: string;
  linkStatus: string | null;
  activeRecipeVersionId: string | null;
  recipeName: string | null;
  recipeVersionCode: string | null;
};

type IdRow = {
  id: string;
};

export type KmrsConnectionRecord = {
  id: string;
  organizationId: string;
  locationId: string | null;
  locationName: string | null;
  baseUrl: string;
  kmrsMerchantId: string | null;
  restaurantSlug: string | null;
  status: string;
  lastSyncAt: string | null;
  importedMenuItems: number;
  linkedMenuItems: number;
};

export type KmrsMenuItemAccessTarget = {
  organizationId: string;
  locationId: string | null;
  kmrsConnectionId: string | null;
  baseUrl: string | null;
  restaurantSlug: string | null;
  kmrsMerchantId: string | null;
};

export type KmrsMenuRecipeLinkRecord = {
  id: string;
  organizationId: string;
  kmrsMenuItemId: string;
  recipeId: string;
  activeRecipeVersionId: string;
  recipeName: string;
  recipeVersionCode: string;
  status: string;
  updatedAt: string;
};

export type KmrsSuggestedRecipeLinkResult = {
  totalMenuItems: number;
  matchedRecipeCount: number;
  linkedCount: number;
  alreadyLinkedCount: number;
  skippedWithoutRecipeCount: number;
};

type KmrsSuggestedRecipeLinkCandidate = {
  kmrsMenuItemId: string;
  currentRecipeVersionId: string | null;
  recipeId: string;
  recipeVersionId: string;
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
  let recipeDraftsCreated = 0;
  let recipeDraftsUpdated = 0;
  let recipeDraftsSkipped = 0;

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

    const draftResult = await ensureRecipeDraftsForKmrsItems(pool, input.organizationId, validItems);
    recipeDraftsCreated = draftResult.createdCount;
    recipeDraftsUpdated = draftResult.updatedCount;
    recipeDraftsSkipped = draftResult.skippedCount;

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
          recipeDraftsCreated,
          recipeDraftsUpdated,
          recipeDraftsSkipped,
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
    recipeDraftsCreated,
    recipeDraftsUpdated,
    recipeDraftsSkipped,
  };
}

async function ensureRecipeDraftsForKmrsItems(
  pool: DatabasePool,
  organizationId: string,
  items: KmrsMenuImportItem[],
): Promise<{ createdCount: number; updatedCount: number; skippedCount: number }> {
  const unitResult = await pool.query<IdRow>(
    `
      select id
      from units
      where organization_id = $1
        and code = 'pcs'
      limit 1
    `,
    [organizationId],
  );
  const yieldUnitId = getId(unitResult.rows[0], "pcs unit");
  const seenNames = new Set<string>();
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    const name = item.name.trim();
    const normalizedName = name.toLocaleLowerCase("ru-RU");

    if (!name || seenNames.has(normalizedName)) {
      skippedCount += 1;
      continue;
    }

    seenNames.add(normalizedName);
    const recipe = await pool.query<IdRow>(
      `
        insert into recipes (
          organization_id,
          name,
          recipe_type
        )
        values ($1, $2, 'menu_item')
        on conflict (organization_id, name)
        do update set
          is_active = true,
          updated_at = recipes.updated_at
        returning id
      `,
      [organizationId, name],
    );
    const recipeId = getId(recipe.rows[0], "recipe");
    const insertedVersion = await pool.query<IdRow>(
      `
        insert into recipe_versions (
          recipe_id,
          version_code,
          status,
          yield_quantity,
          yield_unit_id,
          servings,
          target_food_cost_percent,
          menu_price,
          currency,
          instructions
        )
        values ($1, 'v1', 'draft', 1, $2, 1, 32, $3, $4, $5)
        on conflict (recipe_id, version_code)
        do nothing
        returning id
      `,
      [
        recipeId,
        yieldUnitId,
        item.price ?? null,
        normalizeCurrency(item.currency),
        buildKmrsDraftInstructions(item),
      ],
    );

    if (insertedVersion.rows[0]) {
      createdCount += 1;
      continue;
    }

    const updatedVersion = await pool.query(
      `
        update recipe_versions
        set
          menu_price = coalesce($2, menu_price),
          currency = coalesce($3, currency),
          instructions = coalesce(nullif($4, ''), instructions),
          updated_at = now()
        where recipe_id = $1
          and version_code = 'v1'
          and status = 'draft'
      `,
      [
        recipeId,
        item.price ?? null,
        normalizeCurrency(item.currency),
        buildKmrsDraftInstructions(item),
      ],
    );

    if ((updatedVersion.rowCount ?? 0) > 0) {
      updatedCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  return { createdCount, updatedCount, skippedCount };
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
        kmi.raw_payload#>>'{category,category_name}' as "kmrsCategoryName",
        kmi.name,
        kmi.description,
        kmi.price,
        kmi.currency,
        kmi.is_available as "isAvailable",
        kmi.imported_at as "importedAt",
        link.status as "linkStatus",
        link.active_recipe_version_id as "activeRecipeVersionId",
        r.name as "recipeName",
        rv.version_code as "recipeVersionCode"
      from kmrs_menu_items kmi
      left join lateral (
        select
          id,
          recipe_id,
          active_recipe_version_id,
          status
        from kmrs_menu_recipe_links
        where kmrs_menu_item_id = kmi.id
          and status = 'active'
        order by updated_at desc
        limit 1
      ) link on true
      left join recipes r on r.id = link.recipe_id
      left join recipe_versions rv on rv.id = link.active_recipe_version_id
      where ${clauses.join(" and ")}
      order by kmi.imported_at desc, kmi.name
      limit $2
    `,
    params,
  );

  return result.rows;
}

export async function listKmrsConnections(
  pool: DatabasePool,
  organizationId: string,
  options: { locationId?: string; limit?: number } = {},
): Promise<KmrsConnectionRecord[]> {
  const limit = Math.min(options.limit ?? 50, 200);
  const params: unknown[] = [organizationId, limit];
  const clauses = ["kc.organization_id = $1"];

  if (options.locationId) {
    params.push(options.locationId);
    clauses.push(`kc.location_id = $${params.length}`);
  }

  const result = await pool.query<KmrsConnectionRecord>(
    `
      select
        kc.id,
        kc.organization_id as "organizationId",
        kc.location_id as "locationId",
        l.name as "locationName",
        kc.base_url as "baseUrl",
        kc.kmrs_merchant_id as "kmrsMerchantId",
        coalesce(kc.restaurant_slug, latest.metadata->>'restaurantSlug') as "restaurantSlug",
        kc.status,
        kc.last_sync_at as "lastSyncAt",
        count(distinct kmi.id)::int as "importedMenuItems",
        count(distinct link.id)::int as "linkedMenuItems"
      from kmrs_connections kc
      left join locations l on l.id = kc.location_id
      left join lateral (
        select metadata
        from kmrs_sync_runs
        where kmrs_connection_id = kc.id
        order by started_at desc
        limit 1
      ) latest on true
      left join kmrs_menu_items kmi on kmi.kmrs_connection_id = kc.id
      left join kmrs_menu_recipe_links link
        on link.kmrs_menu_item_id = kmi.id
        and link.status = 'active'
      where ${clauses.join(" and ")}
      group by
        kc.id,
        l.name,
        latest.metadata
      order by kc.last_sync_at desc nulls last, kc.created_at desc
      limit $2
    `,
    params,
  );

  return result.rows;
}

export async function getKmrsMenuItemAccessTarget(
  pool: DatabasePool,
  organizationId: string,
  kmrsMenuItemId: string,
): Promise<KmrsMenuItemAccessTarget | null> {
  const result = await pool.query<KmrsMenuItemAccessTarget>(
    `
      select
        kmi.organization_id as "organizationId",
        kmi.location_id as "locationId",
        kmi.kmrs_connection_id as "kmrsConnectionId",
        kc.base_url as "baseUrl",
        kc.restaurant_slug as "restaurantSlug",
        kc.kmrs_merchant_id as "kmrsMerchantId"
      from kmrs_menu_items kmi
      left join kmrs_connections kc on kc.id = kmi.kmrs_connection_id
      where kmi.organization_id = $1
        and kmi.id = $2
      limit 1
    `,
    [organizationId, kmrsMenuItemId],
  );

  return result.rows[0] ?? null;
}

export async function linkKmrsMenuItemToRecipe(
  pool: DatabasePool,
  input: { organizationId: string; kmrsMenuItemId: string; recipeVersionId: string },
): Promise<KmrsMenuRecipeLinkRecord> {
  const client = await pool.connect();

  try {
    await client.query("begin");
    const menuItem = await getKmrsMenuItemForUpdate(client, input.organizationId, input.kmrsMenuItemId);

    if (!menuItem) {
      throw new Error("KMRS menu item was not found");
    }

    const recipeVersion = await client.query<{
      recipeId: string;
      recipeName: string;
      recipeVersionId: string;
      recipeVersionCode: string;
    }>(
      `
        select
          r.id as "recipeId",
          r.name as "recipeName",
          rv.id as "recipeVersionId",
          rv.version_code as "recipeVersionCode"
        from recipe_versions rv
        join recipes r on r.id = rv.recipe_id
        where r.organization_id = $1
          and rv.id = $2
        limit 1
      `,
      [input.organizationId, input.recipeVersionId],
    );
    const version = recipeVersion.rows[0];

    if (!version) {
      throw new Error("Recipe version was not found");
    }

    await client.query(
      `
        update kmrs_menu_recipe_links
        set status = 'archived'
        where organization_id = $1
          and kmrs_menu_item_id = $2
          and status = 'active'
      `,
      [input.organizationId, input.kmrsMenuItemId],
    );

    const link = await client.query<KmrsMenuRecipeLinkRecord>(
      `
        insert into kmrs_menu_recipe_links (
          organization_id,
          kmrs_menu_item_id,
          recipe_id,
          active_recipe_version_id,
          status
        )
        values ($1, $2, $3, $4, 'active')
        returning
          id,
          organization_id as "organizationId",
          kmrs_menu_item_id as "kmrsMenuItemId",
          recipe_id as "recipeId",
          active_recipe_version_id as "activeRecipeVersionId",
          $5::text as "recipeName",
          $6::text as "recipeVersionCode",
          status,
          updated_at as "updatedAt"
      `,
      [
        input.organizationId,
        input.kmrsMenuItemId,
        version.recipeId,
        input.recipeVersionId,
        version.recipeName,
        version.recipeVersionCode,
      ],
    );

    await client.query("commit");
    return getLink(link.rows[0]);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function linkKmrsMenuItemsToSuggestedRecipes(
  pool: DatabasePool,
  input: { organizationId: string; locationId: string; kmrsConnectionId?: string },
): Promise<KmrsSuggestedRecipeLinkResult> {
  const client = await pool.connect();
  const params: unknown[] = [input.organizationId, input.locationId];
  const menuClauses = ["organization_id = $1", "location_id = $2"];
  const aliasedMenuClauses = ["kmi.organization_id = $1", "kmi.location_id = $2"];

  if (input.kmrsConnectionId) {
    params.push(input.kmrsConnectionId);
    menuClauses.push(`kmrs_connection_id = $${params.length}`);
    aliasedMenuClauses.push(`kmi.kmrs_connection_id = $${params.length}`);
  }

  try {
    await client.query("begin");
    const totalResult = await client.query<{ count: string }>(
      `
        select count(*) as count
        from kmrs_menu_items
        where ${menuClauses.join(" and ")}
      `,
      params,
    );
    const totalMenuItems = Number(totalResult.rows[0]?.count ?? 0);
    const candidateResult = await client.query<KmrsSuggestedRecipeLinkCandidate>(
      `
        select
          kmi.id as "kmrsMenuItemId",
          current_link.active_recipe_version_id as "currentRecipeVersionId",
          suggested.recipe_id as "recipeId",
          suggested.recipe_version_id as "recipeVersionId"
        from kmrs_menu_items kmi
        join lateral (
          select
            r.id as recipe_id,
            rv.id as recipe_version_id
          from recipes r
          join recipe_versions rv on rv.recipe_id = r.id
          where r.organization_id = kmi.organization_id
            and lower(btrim(r.name)) = lower(btrim(kmi.name))
            and rv.status in ('active', 'draft')
          order by
            case rv.status when 'active' then 0 when 'draft' then 1 else 2 end,
            rv.effective_from desc nulls last,
            rv.created_at desc
          limit 1
        ) suggested on true
        left join lateral (
          select active_recipe_version_id
          from kmrs_menu_recipe_links
          where organization_id = kmi.organization_id
            and kmrs_menu_item_id = kmi.id
            and status = 'active'
          order by updated_at desc
          limit 1
        ) current_link on true
        where ${aliasedMenuClauses.join(" and ")}
        order by kmi.name
      `,
      params,
    );
    const candidates = candidateResult.rows;
    const alreadyLinked = candidates.filter((candidate) => (
      candidate.currentRecipeVersionId === candidate.recipeVersionId
    ));
    const targets = candidates.filter((candidate) => (
      candidate.currentRecipeVersionId !== candidate.recipeVersionId
    ));

    for (const target of targets) {
      await client.query(
        `
          update kmrs_menu_recipe_links
          set status = 'archived'
          where organization_id = $1
            and kmrs_menu_item_id = $2
            and status = 'active'
        `,
        [input.organizationId, target.kmrsMenuItemId],
      );
      await client.query(
        `
          insert into kmrs_menu_recipe_links (
            organization_id,
            kmrs_menu_item_id,
            recipe_id,
            active_recipe_version_id,
            status
          )
          values ($1, $2, $3, $4, 'active')
        `,
        [
          input.organizationId,
          target.kmrsMenuItemId,
          target.recipeId,
          target.recipeVersionId,
        ],
      );
    }

    await client.query("commit");

    return {
      totalMenuItems,
      matchedRecipeCount: candidates.length,
      linkedCount: targets.length,
      alreadyLinkedCount: alreadyLinked.length,
      skippedWithoutRecipeCount: Math.max(totalMenuItems - candidates.length, 0),
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function unlinkKmrsMenuItemRecipe(
  pool: DatabasePool,
  input: { organizationId: string; kmrsMenuItemId: string },
): Promise<{ archivedCount: number }> {
  const result = await pool.query(
    `
      update kmrs_menu_recipe_links
      set status = 'archived'
      where organization_id = $1
        and kmrs_menu_item_id = $2
        and status = 'active'
    `,
    [input.organizationId, input.kmrsMenuItemId],
  );

  return { archivedCount: result.rowCount ?? 0 };
}

async function getKmrsMenuItemForUpdate(
  client: DatabaseClient,
  organizationId: string,
  kmrsMenuItemId: string,
): Promise<IdRow | undefined> {
  const result = await client.query<IdRow>(
    `
      select id
      from kmrs_menu_items
      where organization_id = $1
        and id = $2
      for update
    `,
    [organizationId, kmrsMenuItemId],
  );

  return result.rows[0];
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
        and ($5::text is null or restaurant_slug = $5 or restaurant_slug is null)
        and status <> 'archived'
      order by created_at desc
      limit 1
    `,
    [input.organizationId, input.locationId, input.baseUrl, input.kmrsMerchantId, input.restaurantSlug ?? null],
  );

  if (existing.rows[0]) {
    await pool.query(
      `
        update kmrs_connections
        set
          last_sync_at = now(),
          status = 'active',
          restaurant_slug = coalesce($2, restaurant_slug)
        where id = $1
      `,
      [existing.rows[0].id, input.restaurantSlug ?? null],
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
        restaurant_slug,
        auth_mode,
        status,
        last_sync_at
      )
      values ($1, $2, $3, $4, $5, 'manual', 'active', now())
      returning id
    `,
    [input.organizationId, input.locationId, input.baseUrl, input.kmrsMerchantId, input.restaurantSlug ?? null],
  );

  return getId(created.rows[0], "KMRS connection");
}

function getId(row: IdRow | undefined, label: string): string {
  if (!row) {
    throw new Error(`Failed to create ${label}`);
  }

  return row.id;
}

function normalizeCurrency(currency: string | undefined): string {
  const value = currency?.trim().toUpperCase();
  return value && value.length === 3 ? value : "TMT";
}

function buildKmrsDraftInstructions(item: KmrsMenuImportItem): string {
  const description = item.description?.trim();

  if (description) {
    return `Imported from KMRS menu. Description: ${description}`;
  }

  return "Imported from KMRS menu. Add ingredients, processing losses, and preparation steps before activation.";
}

function getLink(row: KmrsMenuRecipeLinkRecord | undefined): KmrsMenuRecipeLinkRecord {
  if (!row) {
    throw new Error("Failed to create KMRS menu recipe link");
  }

  return row;
}
