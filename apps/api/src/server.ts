import cors from "@fastify/cors";
import {
  bootstrapOrganization,
  createDatabasePool,
  createProduct,
  getInventorySummary,
  listKmrsSyncRuns,
  listProducts,
  listRecipeVersions,
} from "@tagam-accounting/database";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

export function buildApi(options: ApiBuildOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: true,
  });
  const pool = createDatabasePool(options.databaseUrl);

  app.register(cors, {
    origin: true,
  });

  app.setErrorHandler((error, _request, reply) => {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("organizationId is required")) {
      return reply.code(400).send({ error: message });
    }

    app.log.error(error);
    return reply.code(500).send({ error: "Internal server error" });
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.API_HOST ?? "0.0.0.0";
  const port = Number.parseInt(process.env.API_PORT ?? "4010", 10);
  const app = buildApi();

  await app.listen({ host, port });
}
