import cors from "@fastify/cors";
import { createKmrsReadonlyClient } from "@tagam-accounting/kmrs-bridge";
import {
  bootstrapOrganization,
  addRecipeLine,
  commitKmrsSaleWriteoff,
  createDatabasePool,
  createProduct,
  createProductCategory,
  createPurchaseReceipt,
  createRecipe,
  createSupplier,
  deleteRecipeLine,
  getDemoSummary,
  getInventorySummary,
  getKmrsMenuItemAccessTarget,
  getPurchasingOverview,
  getRecipeCostDetail,
  importKmrsMenuSnapshot,
  linkKmrsMenuItemToRecipe,
  linkKmrsMenuItemsToSuggestedRecipes,
  listKmrsConnections,
  listKmrsImportedMenuItems,
  listLocations,
  listKmrsSyncRuns,
  listOrganizations,
  listProcessingMethods,
  previewKmrsSaleWriteoff,
  listProducts,
  listProductCategories,
  listRecipeVersions,
  listSuppliers,
  listUnits,
  unlinkKmrsMenuItemRecipe,
  updateRecipeVersion,
} from "@tagam-accounting/database";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAuthConfigFromEnv,
  createWebSessionClearCookieHeader,
  createWebSessionSetCookieHeader,
  getAccountingPrincipal,
  getBridgeScopeDenial,
  routeRequiresAuth,
  verifyAccountingAuth,
  verifyWebLogin,
  verifyWebSession,
} from "./auth.js";
import { renderDashboard } from "./dashboard.js";
import { renderLogin } from "./login.js";

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

type CreateProductCategoryBody = {
  organizationId?: string;
  parentId?: string;
  name?: string;
  accountingCode?: string;
};

type CreateRecipeBody = {
  organizationId?: string;
  name?: string;
  recipeType?: string;
  outputProductId?: string;
  yieldQuantity?: number;
  yieldUnitId?: string;
  targetFoodCostPercent?: number;
  menuPrice?: number;
  currency?: string;
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
  fulfillmentMode?: "dine_in" | "delivery";
};

type RecipeVersionPatchBody = {
  organizationId?: string;
  yieldQuantity?: number;
  yieldUnitId?: string;
  targetFoodCostPercent?: number;
  menuPrice?: number;
  currency?: string;
  instructions?: string;
  status?: "draft" | "active" | "archived";
};

type RecipeLineParams = {
  recipeVersionId: string;
  recipeLineId: string;
};

type RecipeLineBody = {
  organizationId?: string;
  ingredientProductId?: string;
  childRecipeVersionId?: string;
  quantity?: number;
  unitId?: string;
  quantityMode?: "stock_input" | "prepared_output";
  extraWastePercent?: number;
  note?: string;
};

type InventorySummaryQuery = {
  organizationId?: string;
  locationId?: string;
  limit?: string;
};

type SupplierListQuery = {
  organizationId?: string;
  limit?: string;
};

type PurchasingOverviewQuery = {
  organizationId?: string;
  locationId?: string;
  limit?: string;
};

type CreateSupplierBody = {
  organizationId?: string;
  name?: string;
  taxId?: string;
  phone?: string;
  email?: string;
  address?: string;
  paymentTerms?: string;
  reliabilityScore?: number;
};

type CreatePurchaseReceiptBody = {
  organizationId?: string;
  locationId?: string;
  supplierId?: string;
  documentNumber?: string;
  invoiceNumber?: string;
  receivedAt?: string;
  invoiceDate?: string;
  currency?: string;
  lines?: Array<{
    productId?: string;
    quantity?: number;
    unitId?: string;
    unitPrice?: number;
    lotCode?: string;
  }>;
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
  locationId?: string;
  kmrsConnectionId?: string;
  limit?: string;
};

type KmrsConnectionsQuery = {
  organizationId?: string;
  locationId?: string;
  limit?: string;
};

type KmrsMenuItemsQuery = {
  organizationId?: string;
  locationId?: string;
  kmrsConnectionId?: string;
  limit?: string;
};

type KmrsMenuItemLinkParams = {
  kmrsMenuItemId: string;
};

type KmrsMenuItemLinkQuery = {
  organizationId?: string;
};

type KmrsMenuItemLinkBody = {
  organizationId?: string;
  recipeVersionId?: string;
};

type KmrsSuggestedRecipeLinkBody = {
  organizationId?: string;
  locationId?: string;
  kmrsConnectionId?: string;
};

type KmrsWriteoffBody = {
  organizationId?: string;
  locationId?: string;
  kmrsOrderId?: string;
  orderedAt?: string;
  status?: string;
  paymentStatus?: string;
  fulfillmentType?: "dine_in" | "delivery";
  lines?: Array<{
    kmrsItemId?: string;
    name?: string;
    quantity?: number;
    salePrice?: number;
    currency?: string;
    fulfillmentType?: "dine_in" | "delivery";
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

type LoginBody = {
  username?: string;
  password?: string;
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
      message.includes("baseUnitId is required") ||
      message.includes("name is required") ||
      message.includes("kmrsMerchantId is required") ||
      message.includes("restaurantSlug is required") ||
      message.includes("recipeVersionId is required") ||
      message.includes("supplierId is required") ||
      message.includes("productType must") ||
      message.includes("inventoryPolicy must") ||
      message.includes("defaultWastePercent must") ||
      message.includes("reliabilityScore must") ||
      message.includes("recipeType must") ||
      message.includes("parentId must") ||
      message.includes("ingredientProductId is required") ||
      message.includes("childRecipeVersionId") ||
      message.includes("Recipe line must contain") ||
      message.includes("Recipe nesting cycle is not allowed") ||
      message.includes("unitId is required") ||
      message.includes("quantity must") ||
      message.includes("yieldQuantity must") ||
      message.includes("targetFoodCostPercent must") ||
      message.includes("menuPrice must") ||
      message.includes("extraWastePercent must") ||
      message.includes("quantityMode must") ||
      message.includes("status must") ||
      message.includes("unitPrice must") ||
      message.includes("Unit conversion was not found") ||
      message.includes("must contain at least one ingredient") ||
      message.includes("purchase line") ||
      message.includes("lines[") ||
      message.includes("lines must") ||
      message.includes("items must")
    ) {
      return reply.code(400).send({ error: message });
    }

    if (message.includes("was not found")) {
      return reply.code(404).send({ error: message });
    }

    if (
      message.includes("Product name already exists") ||
      message.includes("Product category name already exists") ||
      message.includes("Supplier name already exists") ||
      message.includes("Recipe name already exists") ||
      message.includes("Receiving document number already exists") ||
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

  app.get("/", async (request, reply) => {
    const webSession = verifyWebSession(request, authConfig);

    if (!webSession.ok && authConfig.webLogin) {
      return reply.redirect("/login");
    }

    return reply.type("text/html; charset=utf-8").send(renderDashboard());
  });

  app.get("/login", async (request, reply) => {
    const webSession = verifyWebSession(request, authConfig);

    if (webSession.ok) {
      return reply.redirect("/");
    }

    return reply.type("text/html; charset=utf-8").send(renderLogin());
  });

  app.post<{ Body: LoginBody }>("/login", async (request, reply) => {
    const result = verifyWebLogin(authConfig, {
      username: request.body?.username,
      password: request.body?.password,
    });

    if (!result.ok) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    return reply
      .header("set-cookie", createWebSessionSetCookieHeader(authConfig))
      .send({ data: { ok: true } });
  });

  app.post("/logout", async (_request, reply) => {
    return reply
      .header("set-cookie", createWebSessionClearCookieHeader(authConfig))
      .send({ data: { ok: true } });
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
      baseUnitId: body.baseUnitId.trim(),
      name: body.name.trim(),
      ...(body.categoryId?.trim() ? { categoryId: body.categoryId.trim() } : {}),
      ...(body.sku?.trim() ? { sku: body.sku.trim() } : {}),
      ...(body.productType !== undefined ? { productType: body.productType } : {}),
      ...(body.inventoryPolicy !== undefined ? { inventoryPolicy: body.inventoryPolicy } : {}),
      ...(body.defaultWastePercent !== undefined ? { defaultWastePercent: body.defaultWastePercent } : {}),
    });

    return reply.code(201).send({ data: product });
  });

  app.post<{ Body: CreateProductCategoryBody }>("/v1/product-categories", async (request, reply) => {
    const body = request.body;
    const organizationId = body.organizationId ?? getHeaderOrganizationId(request);

    if (!organizationId) {
      return reply.code(400).send({ error: "organizationId is required" });
    }

    if (!body.name?.trim()) {
      return reply.code(400).send({ error: "name is required" });
    }

    const category = await createProductCategory(pool, {
      organizationId,
      name: body.name.trim(),
      ...(body.parentId?.trim() ? { parentId: body.parentId.trim() } : {}),
      ...(body.accountingCode?.trim() ? { accountingCode: body.accountingCode.trim() } : {}),
    });

    return reply.code(201).send({ data: category });
  });

  app.get<{ Querystring: ListRecipesQuery }>("/v1/recipes", async (request) => {
    const organizationId = getOrganizationId(request);
    const recipes = await listRecipeVersions(pool, organizationId, {
      limit: parseLimit(request.query.limit, 50),
      ...(request.query.status !== undefined ? { status: request.query.status } : {}),
    });

    return { data: recipes };
  });

  app.post<{ Body: CreateRecipeBody }>("/v1/recipes", async (request, reply) => {
    const body = request.body;
    const organizationId = body.organizationId ?? getHeaderOrganizationId(request);

    if (!organizationId) {
      return reply.code(400).send({ error: "organizationId is required" });
    }

    if (!body.name?.trim()) {
      return reply.code(400).send({ error: "name is required" });
    }

    if (!body.yieldUnitId?.trim()) {
      return reply.code(400).send({ error: "yieldUnitId is required" });
    }

    const recipe = await createRecipe(pool, {
      organizationId,
      name: body.name.trim(),
      yieldQuantity: body.yieldQuantity ?? 1,
      yieldUnitId: body.yieldUnitId.trim(),
      ...(body.recipeType !== undefined ? { recipeType: body.recipeType } : {}),
      ...(body.outputProductId?.trim() ? { outputProductId: body.outputProductId.trim() } : {}),
      ...(body.targetFoodCostPercent !== undefined ? { targetFoodCostPercent: body.targetFoodCostPercent } : {}),
      ...(body.menuPrice !== undefined ? { menuPrice: body.menuPrice } : {}),
      ...(body.currency !== undefined ? { currency: body.currency } : {}),
    });

    return reply.code(201).send({ data: recipe });
  });

  app.get<{ Params: RecipeDetailParams; Querystring: RecipeDetailQuery }>(
    "/v1/recipes/:recipeVersionId",
    async (request, reply) => {
      const organizationId = getOrganizationId(request);
      const detail = await getRecipeCostDetail(pool, organizationId, request.params.recipeVersionId, {
        ...(request.query.locationId !== undefined ? { locationId: request.query.locationId } : {}),
        ...(request.query.fulfillmentMode !== undefined ? { fulfillmentMode: request.query.fulfillmentMode } : {}),
      });

      if (!detail) {
        return reply.code(404).send({ error: "recipeVersion was not found" });
      }

      return { data: detail };
    },
  );

  app.patch<{ Params: RecipeDetailParams; Body: RecipeVersionPatchBody }>(
    "/v1/recipes/:recipeVersionId",
    async (request) => {
      const organizationId = request.body.organizationId ?? getHeaderOrganizationId(request);

      if (!organizationId) {
        throw new Error("organizationId is required");
      }

      const result = await updateRecipeVersion(pool, {
        organizationId,
        recipeVersionId: request.params.recipeVersionId,
        ...(request.body.yieldQuantity !== undefined ? { yieldQuantity: request.body.yieldQuantity } : {}),
        ...(request.body.yieldUnitId !== undefined ? { yieldUnitId: request.body.yieldUnitId } : {}),
        ...(request.body.targetFoodCostPercent !== undefined
          ? { targetFoodCostPercent: request.body.targetFoodCostPercent }
          : {}),
        ...(request.body.menuPrice !== undefined ? { menuPrice: request.body.menuPrice } : {}),
        ...(request.body.currency !== undefined ? { currency: request.body.currency } : {}),
        ...(request.body.instructions !== undefined ? { instructions: request.body.instructions } : {}),
        ...(request.body.status !== undefined ? { status: request.body.status } : {}),
      });

      return { data: result };
    },
  );

  app.post<{ Params: RecipeDetailParams; Body: RecipeLineBody }>(
    "/v1/recipes/:recipeVersionId/lines",
    async (request, reply) => {
      const organizationId = request.body.organizationId ?? getHeaderOrganizationId(request);

      if (!organizationId) {
        throw new Error("organizationId is required");
      }

      const result = await addRecipeLine(pool, {
        organizationId,
        recipeVersionId: request.params.recipeVersionId,
        ...(request.body.ingredientProductId !== undefined ? { ingredientProductId: request.body.ingredientProductId } : {}),
        ...(request.body.childRecipeVersionId !== undefined ? { childRecipeVersionId: request.body.childRecipeVersionId } : {}),
        quantity: request.body.quantity ?? 0,
        unitId: request.body.unitId ?? "",
        ...(request.body.quantityMode !== undefined ? { quantityMode: request.body.quantityMode } : {}),
        ...(request.body.extraWastePercent !== undefined ? { extraWastePercent: request.body.extraWastePercent } : {}),
        ...(request.body.note !== undefined ? { note: request.body.note } : {}),
      });

      return reply.code(201).send({ data: result });
    },
  );

  app.delete<{ Params: RecipeLineParams; Querystring: RecipeDetailQuery }>(
    "/v1/recipes/:recipeVersionId/lines/:recipeLineId",
    async (request) => {
      const organizationId = request.query.organizationId ?? getHeaderOrganizationId(request);

      if (!organizationId) {
        throw new Error("organizationId is required");
      }

      const result = await deleteRecipeLine(pool, {
        organizationId,
        recipeVersionId: request.params.recipeVersionId,
        recipeLineId: request.params.recipeLineId,
      });

      return { data: result };
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

  app.get<{ Querystring: SupplierListQuery }>("/v1/suppliers", async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const scopeDenial = getBridgeScopeDenial(authConfig, getAccountingPrincipal(request), {
      organizationId,
    });

    if (scopeDenial) {
      return reply.code(403).send({ error: scopeDenial });
    }

    const suppliers = await listSuppliers(pool, organizationId, {
      limit: parseLimit(request.query.limit, 100),
    });

    return { data: suppliers };
  });

  app.post<{ Body: CreateSupplierBody }>("/v1/suppliers", async (request, reply) => {
    const body = request.body;
    const organizationId = body.organizationId ?? getHeaderOrganizationId(request);

    if (!organizationId) {
      return reply.code(400).send({ error: "organizationId is required" });
    }

    const scopeDenial = getBridgeScopeDenial(authConfig, getAccountingPrincipal(request), {
      organizationId,
    });

    if (scopeDenial) {
      return reply.code(403).send({ error: scopeDenial });
    }

    if (!body.name?.trim()) {
      return reply.code(400).send({ error: "name is required" });
    }

    const supplier = await createSupplier(pool, {
      organizationId,
      name: body.name.trim(),
      ...(body.taxId !== undefined ? { taxId: body.taxId } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
      ...(body.paymentTerms !== undefined ? { paymentTerms: body.paymentTerms } : {}),
      ...(body.reliabilityScore !== undefined ? { reliabilityScore: body.reliabilityScore } : {}),
    });

    return reply.code(201).send({ data: supplier });
  });

  app.get<{ Querystring: PurchasingOverviewQuery }>("/v1/purchasing/overview", async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const scopeDenial = getBridgeScopeDenial(authConfig, getAccountingPrincipal(request), {
      organizationId,
      ...(request.query.locationId !== undefined ? { locationId: request.query.locationId } : {}),
    }, { require: ["organizationId", "locationId"] });

    if (scopeDenial) {
      return reply.code(403).send({ error: scopeDenial });
    }

    const overview = await getPurchasingOverview(pool, organizationId, {
      limit: parseLimit(request.query.limit, 50),
      ...(request.query.locationId !== undefined ? { locationId: request.query.locationId } : {}),
    });

    return { data: overview };
  });

  app.post<{ Body: CreatePurchaseReceiptBody }>("/v1/purchasing/receipts", async (request, reply) => {
    const body = request.body;
    const organizationId = body.organizationId ?? getHeaderOrganizationId(request);

    if (!organizationId) {
      return reply.code(400).send({ error: "organizationId is required" });
    }

    if (!body.locationId?.trim()) {
      return reply.code(400).send({ error: "locationId is required" });
    }

    if (!body.supplierId?.trim()) {
      return reply.code(400).send({ error: "supplierId is required" });
    }

    const scopeDenial = getBridgeScopeDenial(authConfig, getAccountingPrincipal(request), {
      organizationId,
      locationId: body.locationId.trim(),
    }, { require: ["organizationId", "locationId"] });

    if (scopeDenial) {
      return reply.code(403).send({ error: scopeDenial });
    }

    const result = await createPurchaseReceipt(pool, {
      organizationId,
      locationId: body.locationId.trim(),
      supplierId: body.supplierId.trim(),
      ...(body.documentNumber !== undefined ? { documentNumber: body.documentNumber } : {}),
      ...(body.invoiceNumber !== undefined ? { invoiceNumber: body.invoiceNumber } : {}),
      ...(body.receivedAt !== undefined ? { receivedAt: body.receivedAt } : {}),
      ...(body.invoiceDate !== undefined ? { invoiceDate: body.invoiceDate } : {}),
      ...(body.currency !== undefined ? { currency: body.currency } : {}),
      lines: (body.lines ?? []).map((line) => ({
        productId: line.productId ?? "",
        quantity: line.quantity ?? 0,
        unitId: line.unitId ?? "",
        unitPrice: line.unitPrice ?? 0,
        ...(line.lotCode !== undefined ? { lotCode: line.lotCode } : {}),
      })),
    });

    return reply.code(201).send({ data: result });
  });

  app.get<{ Querystring: KmrsSyncRunsQuery }>("/v1/kmrs/sync-runs", async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const scopeDenial = getBridgeScopeDenial(authConfig, getAccountingPrincipal(request), {
      organizationId,
      ...(request.query.locationId !== undefined ? { locationId: request.query.locationId } : {}),
      ...(request.query.kmrsConnectionId !== undefined ? { kmrsConnectionId: request.query.kmrsConnectionId } : {}),
    }, { require: ["locationId"] });

    if (scopeDenial) {
      return forbidden(reply, scopeDenial);
    }

    const rows = await listKmrsSyncRuns(pool, organizationId, {
      limit: parseLimit(request.query.limit, 25),
      ...(request.query.locationId !== undefined ? { locationId: request.query.locationId } : {}),
      ...(request.query.kmrsConnectionId !== undefined ? { kmrsConnectionId: request.query.kmrsConnectionId } : {}),
    });

    return { data: rows };
  });

  app.get<{ Querystring: KmrsConnectionsQuery }>("/v1/kmrs/connections", async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const scopeDenial = getBridgeScopeDenial(authConfig, getAccountingPrincipal(request), {
      organizationId,
      ...(request.query.locationId !== undefined ? { locationId: request.query.locationId } : {}),
    }, { require: ["locationId"] });

    if (scopeDenial) {
      return forbidden(reply, scopeDenial);
    }

    const rows = await listKmrsConnections(pool, organizationId, {
      limit: parseLimit(request.query.limit, 50),
      ...(request.query.locationId !== undefined ? { locationId: request.query.locationId } : {}),
    });

    return { data: rows };
  });

  app.get<{ Querystring: KmrsMenuItemsQuery }>("/v1/kmrs/menu-items", async (request, reply) => {
    const organizationId = getOrganizationId(request);
    const scopeDenial = getBridgeScopeDenial(authConfig, getAccountingPrincipal(request), {
      organizationId,
      ...(request.query.locationId !== undefined ? { locationId: request.query.locationId } : {}),
      ...(request.query.kmrsConnectionId !== undefined ? { kmrsConnectionId: request.query.kmrsConnectionId } : {}),
    }, { require: ["locationId"] });

    if (scopeDenial) {
      return forbidden(reply, scopeDenial);
    }

    const rows = await listKmrsImportedMenuItems(pool, organizationId, {
      limit: parseLimit(request.query.limit, 100),
      ...(request.query.locationId !== undefined ? { locationId: request.query.locationId } : {}),
      ...(request.query.kmrsConnectionId !== undefined ? { kmrsConnectionId: request.query.kmrsConnectionId } : {}),
    });

    return { data: rows };
  });

  app.post<{ Body: KmrsSuggestedRecipeLinkBody }>("/v1/kmrs/menu-items/link-suggested", async (request, reply) => {
    const organizationId = request.body.organizationId ?? getHeaderOrganizationId(request);

    if (!organizationId) {
      return reply.code(400).send({ error: "organizationId is required" });
    }

    if (!request.body.locationId) {
      return reply.code(400).send({ error: "locationId is required" });
    }

    const scopeDenial = getBridgeScopeDenial(authConfig, getAccountingPrincipal(request), {
      organizationId,
      locationId: request.body.locationId,
      ...(request.body.kmrsConnectionId !== undefined ? { kmrsConnectionId: request.body.kmrsConnectionId } : {}),
    }, { require: ["locationId"] });

    if (scopeDenial) {
      return forbidden(reply, scopeDenial);
    }

    const result = await linkKmrsMenuItemsToSuggestedRecipes(pool, {
      organizationId,
      locationId: request.body.locationId,
      ...(request.body.kmrsConnectionId !== undefined ? { kmrsConnectionId: request.body.kmrsConnectionId } : {}),
    });

    return reply.send({ data: result });
  });

  app.put<{ Params: KmrsMenuItemLinkParams; Body: KmrsMenuItemLinkBody }>(
    "/v1/kmrs/menu-items/:kmrsMenuItemId/link",
    async (request, reply) => {
      const organizationId = request.body.organizationId ?? getHeaderOrganizationId(request);

      if (!organizationId) {
        return reply.code(400).send({ error: "organizationId is required" });
      }

      if (!request.body.recipeVersionId) {
        return reply.code(400).send({ error: "recipeVersionId is required" });
      }

      const target = await getKmrsMenuItemAccessTarget(pool, organizationId, request.params.kmrsMenuItemId);

      if (!target) {
        return reply.code(404).send({ error: "KMRS menu item was not found" });
      }

      const scopeDenial = getBridgeScopeDenial(authConfig, getAccountingPrincipal(request), {
        organizationId: target.organizationId,
        ...(target.locationId !== null ? { locationId: target.locationId } : {}),
        ...(target.kmrsConnectionId !== null ? { kmrsConnectionId: target.kmrsConnectionId } : {}),
        ...(target.baseUrl !== null ? { baseUrl: target.baseUrl } : {}),
        ...(target.restaurantSlug !== null ? { restaurantSlug: target.restaurantSlug } : {}),
        ...(target.kmrsMerchantId !== null ? { kmrsMerchantId: target.kmrsMerchantId } : {}),
      }, { require: ["locationId"] });

      if (scopeDenial) {
        return forbidden(reply, scopeDenial);
      }

      const link = await linkKmrsMenuItemToRecipe(pool, {
        organizationId,
        kmrsMenuItemId: request.params.kmrsMenuItemId,
        recipeVersionId: request.body.recipeVersionId,
      });

      return reply.send({ data: link });
    },
  );

  app.delete<{ Params: KmrsMenuItemLinkParams; Querystring: KmrsMenuItemLinkQuery }>(
    "/v1/kmrs/menu-items/:kmrsMenuItemId/link",
    async (request, reply) => {
      const organizationId = request.query.organizationId ?? getHeaderOrganizationId(request);

      if (!organizationId) {
        return reply.code(400).send({ error: "organizationId is required" });
      }

      const target = await getKmrsMenuItemAccessTarget(pool, organizationId, request.params.kmrsMenuItemId);

      if (!target) {
        return reply.code(404).send({ error: "KMRS menu item was not found" });
      }

      const scopeDenial = getBridgeScopeDenial(authConfig, getAccountingPrincipal(request), {
        organizationId: target.organizationId,
        ...(target.locationId !== null ? { locationId: target.locationId } : {}),
        ...(target.kmrsConnectionId !== null ? { kmrsConnectionId: target.kmrsConnectionId } : {}),
        ...(target.baseUrl !== null ? { baseUrl: target.baseUrl } : {}),
        ...(target.restaurantSlug !== null ? { restaurantSlug: target.restaurantSlug } : {}),
        ...(target.kmrsMerchantId !== null ? { kmrsMerchantId: target.kmrsMerchantId } : {}),
      }, { require: ["locationId"] });

      if (scopeDenial) {
        return forbidden(reply, scopeDenial);
      }

      const result = await unlinkKmrsMenuItemRecipe(pool, {
        organizationId,
        kmrsMenuItemId: request.params.kmrsMenuItemId,
      });

      return reply.send({ data: result });
    },
  );

  app.post<{ Body: KmrsMenuImportBody }>("/v1/kmrs/import/menu", async (request, reply) => {
    const input = parseKmrsMenuImportBody(request);
    const scopeDenial = getBridgeScopeDenial(authConfig, getAccountingPrincipal(request), {
      organizationId: input.organizationId,
      locationId: input.locationId,
      baseUrl: input.baseUrl,
      kmrsMerchantId: input.kmrsMerchantId,
      ...(input.restaurantSlug !== undefined ? { restaurantSlug: input.restaurantSlug } : {}),
    });

    if (scopeDenial) {
      return forbidden(reply, scopeDenial);
    }

    const result = await importKmrsMenuSnapshot(pool, input);
    return reply.code(201).send({ data: result });
  });

  app.post<{ Body: KmrsPullMenuImportBody }>("/v1/kmrs/import/menu-from-kmrs", async (request, reply) => {
    const body = parseKmrsPullMenuImportBody(request);
    const preflightScopeDenial = getBridgeScopeDenial(authConfig, getAccountingPrincipal(request), {
      organizationId: body.organizationId,
      locationId: body.locationId,
      baseUrl: body.baseUrl,
      restaurantSlug: body.restaurantSlug,
    });

    if (preflightScopeDenial) {
      return forbidden(reply, preflightScopeDenial);
    }

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
    const snapshotScopeDenial = getBridgeScopeDenial(authConfig, getAccountingPrincipal(request), {
      organizationId: snapshot.organizationId,
      locationId: snapshot.locationId,
      baseUrl: snapshot.baseUrl,
      kmrsMerchantId: snapshot.kmrsMerchantId,
      ...(snapshot.restaurantSlug !== undefined ? { restaurantSlug: snapshot.restaurantSlug } : {}),
    });

    if (snapshotScopeDenial) {
      return forbidden(reply, snapshotScopeDenial);
    }

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
    const scopeDenial = getBridgeScopeDenial(authConfig, getAccountingPrincipal(request), {
      organizationId: input.organizationId,
      locationId: input.locationId,
    });

    if (scopeDenial) {
      return forbidden(reply, scopeDenial);
    }

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

function forbidden(reply: FastifyReply, reason: string) {
  return reply.code(403).send({ error: "Forbidden", reason });
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
    ...(body.fulfillmentType !== undefined ? { fulfillmentType: body.fulfillmentType } : {}),
    lines: (body.lines ?? []).map((line) => ({
      kmrsItemId: line.kmrsItemId ?? "",
      quantity: line.quantity ?? 0,
      ...(line.name !== undefined ? { name: line.name } : {}),
      ...(line.salePrice !== undefined ? { salePrice: line.salePrice } : {}),
      ...(line.currency !== undefined ? { currency: line.currency } : {}),
      ...(line.fulfillmentType !== undefined ? { fulfillmentType: line.fulfillmentType } : {}),
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
