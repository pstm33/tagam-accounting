import cors from "@fastify/cors";
import { createKmrsReadonlyClient } from "@tagam-accounting/kmrs-bridge";
import {
  bootstrapOrganization,
  commitKmrsSaleWriteoff,
  createDatabasePool,
  createProduct,
  getDemoSummary,
  getInventorySummary,
  getRecipeCostDetail,
  importKmrsMenuSnapshot,
  listKmrsImportedMenuItems,
  listLocations,
  listKmrsSyncRuns,
  listOrganizations,
  listProcessingMethods,
  previewKmrsSaleWriteoff,
  listProducts,
  listProductCategories,
  listRecipeVersions,
  listUnits,
} from "@tagam-accounting/database";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createAuthConfigFromEnv, routeRequiresAuth, verifyAccountingAuth } from "./auth.js";
import { renderDashboard } from "./dashboard.js";

export type ApiBuildOptions = {
  databaseUrl?: string;
};

type ListProductsQuery = {
  organizationId?: string;
  search?: string;
  limit?: string;
};

type CreateProductBody = {
  organizationId?: string;
  baseUnitId?: string;
  categoryId?: string;
  name?: string;
  sku?: string;
  productType?: string;
  inventoryPolicy?: string;
  defaultWastePercent?: number;
};

type ListRecipesQuery = {
  organizationId?: string;
  status?: string;
  limit?: string;
};

type RecipeDetailParams = {
  recipeVersionId: string;
};

type RecipeDetailQuery = {
  organizationId?: string;
  locationId?: string;
};

type InventorySummaryQuery = {
  organizationId?: string;
  locationId?: string;
  limit?: string;
};

type BootstrapBody = {
  organizationName?: string;
  legalName?: string;
  defaultCurrency?: string;
  timezone?: string;
  locationName?: string;
  kmrsMerchantId?: string;
};

type KmrsSyncRunsQuery = {
  organizationId?: string;
  limit?: string;
};

type KmrsMenuItemsQuery = {
  organizationId?: string;
  locationId?: string;
  kmrsConnectionId?: string;
  limit?: string;
};

type KmrsWriteoffBody = {
  organizationId?: string;
  locationId?: string;
  kmrsOrderId?: string;
  orderedAt?: string;
  status?: string;
  paymentStatus?: string;
  lines?: Array<{
    kmrsItemId?: string;
    name?: string;
    quantity?: number;
    salePrice?: number;
    currency?: string;
    rawPayload?: unknown;
  }>;
  rawPayload?: unknown;
};

type KmrsMenuImportBody = {
  organizationId?: string;
  locationId?: string;
  baseUrl?: string;
  kmrsMerchantId?: string;
  restaurantSlug?: string;
  items?: Array<{
    kmrsItemId?: string;
    kmrsCategoryId?: string;
    categoryId?: string;
    name?: string;
    description?: string;
    price?: number;
    currency?: string;
    isAvailable?: boolean;
    rawPayload?: unknown;
    raw?: unknown;
  }>;
  rawPayload?: unknown;
};

type KmrsPullMenuImportBody = {
  organizationId?: string;
  locationId?: string;
  baseUrl?: string;
  restaurantSlug?: string;
  currencyCode?: string;
};

export function buildApi(options: ApiBuildOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: true,
  });
  const pool = createDatabasePool(options.databaseUrl);
  const authConfig = createAuthConfigFromEnv();

  app.register(cors, {
    origin: true,
  });

  app.setErrorHandler((error, _request, reply) => {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (
      message.includes("organizationId is required") ||
      message.includes("locationId is required") ||
      message.includes("baseUrl is required") ||
      message.includes("kmrsMerchantId is required") ||
      message.includes("restaurantSlug is required") ||
      message.includes("lines[") ||
      message.includes("lines must") ||
      message.includes("items must")
    ) {
      return reply.code(400).send({ error: message });
    }

    if (
      message.includes("Cannot commit writeoff") ||
      message.includes("already has a committed writeoff") ||
      message.startsWith("Not enough stock")
    ) {
      return reply.code(409).send({ error: message });
    }

    app.log.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  });

  app.addHook("preHandler", async (request, reply) => {
    if (!routeRequiresAuth(request, authConfig)) {
      return;
    }

    const result = verifyAccountingAuth(request, authConfig);

    if (!result.ok) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    request.headers["x-accounting-principal"] = result.principal;
  });

  app.addHook("onClose", async () => {
    await pool.end();
  });

  app.get("/health", async () => {
    const startedAt = Date.now();
    await pool.query("select 1");

    return {
      ok: true,
      service: "tagam-accounting-api",
      database: "connected",
      latencyMs: Date.now() - startedAt,
    };
  });

  app.get("/", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(renderDashboard());
  });

  app.get("/v1/demo", async (_request, reply) => {
    const summary = await getDemoSummary(pool);

    if (!summary) {
      return reply.code(404).send({ error: "Demo organization has not been seeded yet" });
    }

    return { data: summary };
  });

  app.get("/v1/organizations", async () => {
    const organizations = await listOrganizations(pool);
    return { data: organizations };
  });

  app.post<{ Body: BootstrapBody }>("/v1/bootstrap", async (request, reply) => {
    const body = request.body;

    if (!body.organizationName?.trim()) {
      return reply.code(400).send({ error: "organizationName is required" });
    }

    const result = await bootstrapOrganization(pool, {
      organizationName: body.organizationName.trim(),
      ...(body.legalName !== undefined ? { legalName: body.legalName } : {}),
      ...(body.defaultCurrency !== undefined ? { defaultCurrency: body.defaultCurrency } : {}),
      ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
      ...(body.locationName !== undefined ? { locationName: body.locationName } : {}),
      ...(body.kmrsMerchantId !== undefined ? { kmrsMerchantId: body.kmrsMerchantId } : {}),
    });

    return reply.code(201).send({ data: result });
  });

  app.get<{ Querystring: { organizationId?: string } }>("/v1/catalog", async (request) => {
    const organizationId = getOrganizationId(request);
    const [locations, units, categories, processingMethods] = await Promise.all([
      listLocations(pool, organizationId),
      listUnits(pool, organizationId),
      listProductCategories(pool, organizationId),
      listProcessingMethods(pool, organizationId),
    ]);

    return {
      data: {
        locations,
        units,
        categories,
        processingMethods,
      },
    };
  });

  app.get<{ Querystring: ListProductsQuery }>("/v1/products", async (request) => {
    const organizationId = getOrganizationId(request);
    const products = await listProducts(pool, organizationId, {
      limit: parseLimit(request.query.limit, 50),
      ...(request.query.search !== undefined ? { search: request.query.search } : {}),
    });

    return { data: products };
  });

  app.post<{ Body: CreateProductBody }>("/v1/products", async (request, reply) => {
    const body = request.body;
    const organizationId = body.organizationId ?? getHeaderOrganizationId(request);

    if (!organizationId) {
      return reply.code(400).send({ error: "organizationId is required" });
    }

    if (!body.baseUnitId) {
      return reply.code(400).send({ error: "baseUnitId is required" });
    }

    if (!body.name?.trim()) {
      return reply.code(400).send({ error: "name is required" });
    }

    const product = await createProduct(pool, {
      organizationId,
      baseUnitId: body.baseUnitId,
      name: body.name.trim(),
      ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
      ...(body.sku !== undefined ? { sku: body.sku } : {}),
      ...(body.productType !== undefined ? { productType: body.productType } : {}),
      ...(body.inventoryPolicy !== undefined ? { inventoryPolicy: body.inventoryPolicy } : {}),
      ...(body.defaultWastePercent !== undefined ? { defaultWastePercent: body.defaultWastePercent } : {}),
    });

    return reply.code(201).send({ data: product });
  });

  app.get<{ Querystring: ListRecipesQuery }>("/v1/recipes", async (request) => {
    const organizationId = getOrganizationId(request);
    const recipes = await listRecipeVersions(pool, organizationId, {
      limit: parseLimit(request.query.limit, 50),
      ...(request.query.status !== undefined ? { status: request.query.status } : {}),
    });

    return { data: recipes };
  });

  app.get<{ Params: RecipeDetailParams; Querystring: RecipeDetailQuery }>(
    "/v1/recipes/:recipeVersionId",
    async (request, reply) => {
      const organizationId = getOrganizationId(request);
      const detail = await getRecipeCostDetail(pool, organizationId, request.params.recipeVersionId, {
        ...(request.query.locationId !== undefined ? { locationId: request.query.locationId } : {}),
      });

      if (!detail) {
        return reply.code(404).send({ error: "recipeVersion was not found" });
      }

      return { data: detail };
    },
  );

  app.get<{ Querystring: InventorySummaryQuery }>("/v1/inventory/summary", async (request) => {
    const organizationId = getOrganizationId(request);
    const rows = await getInventorySummary(pool, organizationId, {
      limit: parseLimit(request.query.limit, 100),
      ...(request.query.locationId !== undefined ? { locationId: request.query.locationId } : {}),
    });

    return { data: rows };
  });

  app.get<{ Querystring: KmrsSyncRunsQuery }>("/v1/kmrs/sync-runs", async (request) => {
    const organizationId = getOrganizationId(request);
    const rows = await listKmrsSyncRuns(pool, organizationId, {
      limit: parseLimit(request.query.limit, 25),
    });

    return { data: rows };
  });

  app.get<{ Querystring: KmrsMenuItemsQuery }>("/v1/kmrs/menu-items", async (request) => {
    const organizationId = getOrganizationId(request);
    const rows = await listKmrsImportedMenuItems(pool, organizationId, {
      limit: parseLimit(request.query.limit, 100),
      ...(request.query.locationId !== undefined ? { locationId: request.query.locationId } : {}),
      ...(request.query.kmrsConnectionId !== undefined ? { kmrsConnectionId: request.query.kmrsConnectionId } : {}),
    });

    return { data: rows };
  });

  app.post<{ Body: KmrsMenuImportBody }>("/v1/kmrs/import/menu", async (request, reply) => {
    const input = parseKmrsMenuImportBody(request);
    const result = await importKmrsMenuSnapshot(pool, input);
    return reply.code(201).send({ data: result });
  });

  app.post<{ Body: KmrsPullMenuImportBody }>("/v1/kmrs/import/menu-from-kmrs", async (request, reply) => {
    const body = parseKmrsPullMenuImportBody(request);
    const client = createKmrsReadonlyClient({
      baseUrl: body.baseUrl,
      currencyCode: body.currencyCode,
      timeoutMs: 12_000,
    });
    const snapshot = await client.getStoreMenuSnapshot({
      organizationId: body.organizationId,
      locationId: body.locationId,
      restaurantSlug: body.restaurantSlug,
    });
    const result = await importKmrsMenuSnapshot(pool, {
      organizationId: snapshot.organizationId,
      locationId: snapshot.locationId,
      baseUrl: snapshot.baseUrl,
      kmrsMerchantId: snapshot.kmrsMerchantId,
      ...(snapshot.restaurantSlug !== undefined ? { restaurantSlug: snapshot.restaurantSlug } : {}),
      items: snapshot.items.map((item) => ({
        kmrsItemId: item.kmrsItemId,
        ...(item.categoryId !== undefined ? { kmrsCategoryId: item.categoryId } : {}),
        name: item.name,
        ...(item.description !== undefined ? { description: item.description } : {}),
        ...(item.price !== undefined ? { price: item.price } : {}),
        ...(item.currency !== undefined ? { currency: item.currency } : {}),
        ...(item.isAvailable !== undefined ? { isAvailable: item.isAvailable } : {}),
        ...(item.raw !== undefined ? { rawPayload: item.raw } : {}),
      })),
      ...(snapshot.raw !== undefined ? { rawPayload: snapshot.raw } : {}),
    });

    return reply.code(201).send({
      data: {
        ...result,
        restaurantSlug: snapshot.restaurantSlug,
        kmrsMerchantId: snapshot.kmrsMerchantId,
      },
    });
  });

  app.post<{ Body: KmrsWriteoffBody }>("/v1/kmrs/orders/preview-writeoff", async (request) => {
    const input = parseKmrsWriteoffBody(request);
    const preview = await previewKmrsSaleWriteoff(pool, input);
    return { data: preview };
  });

  app.post<{ Body: KmrsWriteoffBody }>("/v1/kmrs/orders/commit-writeoff", async (request, reply) => {
    const input = parseKmrsWriteoffBody(request);
    const committed = await commitKmrsSaleWriteoff(pool, input);
    return reply.code(201).send({ data: committed });
  });

  return app;
}

function getOrganizationId(request: FastifyRequest<{ Querystring: { organizationId?: string } }>): string {
  const organizationId = request.query.organizationId ?? getHeaderOrganizationId(request);

  if (!organizationId) {
    throw new Error("organizationId is required as query param or x-organization-id header");
  }

  return organizationId;
}

function getHeaderOrganizationId(request: FastifyRequest): string | undefined {
  const header = request.headers["x-organization-id"];

  return Array.isArray(header) ? header[0] : header;
}

function parseLimit(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseKmrsWriteoffBody(request: FastifyRequest<{ Body: KmrsWriteoffBody }>) {
  const body = request.body ?? {};
  const organizationId = body.organizationId ?? getHeaderOrganizationId(request);

  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  if (!body.locationId) {
    throw new Error("locationId is required");
  }

  return {
    organizationId,
    locationId: body.locationId,
    ...(body.kmrsOrderId !== undefined ? { kmrsOrderId: body.kmrsOrderId } : {}),
    ...(body.orderedAt !== undefined ? { orderedAt: body.orderedAt } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.paymentStatus !== undefined ? { paymentStatus: body.paymentStatus } : {}),
    lines: (body.lines ?? []).map((line) => ({
      kmrsItemId: line.kmrsItemId ?? "",
      quantity: line.quantity ?? 0,
      ...(line.name !== undefined ? { name: line.name } : {}),
      ...(line.salePrice !== undefined ? { salePrice: line.salePrice } : {}),
      ...(line.currency !== undefined ? { currency: line.currency } : {}),
      ...(line.rawPayload !== undefined ? { rawPayload: line.rawPayload } : {}),
    })),
    ...(body.rawPayload !== undefined ? { rawPayload: body.rawPayload } : {}),
  };
}

function parseKmrsMenuImportBody(request: FastifyRequest<{ Body: KmrsMenuImportBody }>) {
  const body = request.body ?? {};
  const organizationId = body.organizationId ?? getHeaderOrganizationId(request);

  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  if (!body.locationId) {
    throw new Error("locationId is required");
  }

  if (!body.baseUrl?.trim()) {
    throw new Error("baseUrl is required");
  }

  if (!body.kmrsMerchantId?.trim()) {
    throw new Error("kmrsMerchantId is required");
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new Error("items must contain at least one KMRS menu item");
  }

  return {
    organizationId,
    locationId: body.locationId,
    baseUrl: body.baseUrl.trim().replace(/\/$/, ""),
    kmrsMerchantId: body.kmrsMerchantId.trim(),
    ...(body.restaurantSlug !== undefined ? { restaurantSlug: body.restaurantSlug } : {}),
    items: body.items.map((item) => ({
      kmrsItemId: item.kmrsItemId ?? "",
      name: item.name ?? "",
      ...(item.kmrsCategoryId !== undefined || item.categoryId !== undefined
        ? { kmrsCategoryId: item.kmrsCategoryId ?? item.categoryId }
        : {}),
      ...(item.description !== undefined ? { description: item.description } : {}),
      ...(item.price !== undefined ? { price: item.price } : {}),
      ...(item.currency !== undefined ? { currency: item.currency } : {}),
      ...(item.isAvailable !== undefined ? { isAvailable: item.isAvailable } : {}),
      ...(item.rawPayload !== undefined || item.raw !== undefined ? { rawPayload: item.rawPayload ?? item.raw } : {}),
    })),
    ...(body.rawPayload !== undefined ? { rawPayload: body.rawPayload } : {}),
  };
}

function parseKmrsPullMenuImportBody(request: FastifyRequest<{ Body: KmrsPullMenuImportBody }>) {
  const body = request.body ?? {};
  const organizationId = body.organizationId ?? getHeaderOrganizationId(request);

  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  if (!body.locationId) {
    throw new Error("locationId is required");
  }

  if (!body.restaurantSlug?.trim()) {
    throw new Error("restaurantSlug is required");
  }

  return {
    organizationId,
    locationId: body.locationId,
    baseUrl: body.baseUrl?.trim().replace(/\/$/, "") ?? "https://tagam.delivery",
    restaurantSlug: body.restaurantSlug.trim(),
    currencyCode: body.currencyCode ?? "TMT",
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.API_HOST ?? "0.0.0.0";
  const port = Number.parseInt(process.env.API_PORT ?? "4010", 10);
  const app = buildApi();

  await app.listen({ host, port });
}
