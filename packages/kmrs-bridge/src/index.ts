export type KmrsBridgeDirection = "kmrs_to_accounting" | "accounting_to_kmrs";

import { createHash, createHmac } from "node:crypto";

export type KmrsMenuItemImport = {
  merchantId: string;
  kmrsItemId: string;
  categoryId?: string;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  isAvailable?: boolean;
  raw?: unknown;
};

export type KmrsMenuSnapshotImport = {
  organizationId: string;
  locationId: string;
  baseUrl: string;
  kmrsMerchantId: string;
  restaurantSlug?: string;
  items: KmrsMenuItemImport[];
  raw?: unknown;
};

export type KmrsOrderLineImport = {
  kmrsItemId: string;
  name: string;
  quantity: number;
  salePrice?: number;
  modifiers?: KmrsOrderLineImport[];
  raw?: unknown;
};

export type KmrsOrderImport = {
  merchantId: string;
  orderId: string;
  orderUuid?: string;
  status: string;
  paymentStatus?: string;
  deliveryStatus?: string;
  orderedAt: string;
  lines: KmrsOrderLineImport[];
  raw?: unknown;
};

export type AccountingMenuPublishRequest = {
  merchantId: string;
  kmrsItemId: string;
  approvedByUserId: string;
  price?: number;
  currency?: string;
  description?: string;
  composition?: string;
  allergens?: string[];
  portionNote?: string;
};

export type AccountingStopListPublishRequest = {
  merchantId: string;
  kmrsItemId: string;
  reason: "missing_ingredient" | "manual" | "expired_lot" | "low_stock";
  available: boolean;
  approvedByUserId?: string;
};

export type KmrsBridgeEvent =
  | {
      direction: "kmrs_to_accounting";
      type: "menu_item_imported";
      payload: KmrsMenuItemImport;
    }
  | {
      direction: "kmrs_to_accounting";
      type: "order_imported";
      payload: KmrsOrderImport;
    }
  | {
      direction: "accounting_to_kmrs";
      type: "menu_item_publish_requested";
      payload: AccountingMenuPublishRequest;
    }
  | {
      direction: "accounting_to_kmrs";
      type: "stop_list_publish_requested";
      payload: AccountingStopListPublishRequest;
    };

export type AccountingBridgeAuth =
  | {
      mode: "api_key";
      apiKey: string;
    }
  | {
      mode: "hmac";
      keyId: string;
      secret: string;
    };

export type AccountingBridgeClientOptions = {
  baseUrl: string;
  auth: AccountingBridgeAuth;
  timeoutMs?: number;
};

export type AccountingMenuImportResponse = {
  data: {
    kmrsConnectionId: string;
    syncRunId: string;
    importedCount: number;
    skippedCount: number;
  };
};

export type KmrsReadonlyClientOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  currencyCode?: string;
};

type KmrsEnvelope<T> = {
  code?: number;
  msg?: unknown;
  details?: T;
};

type RawKmrsMenuDetails = {
  merchant_id?: string | number;
  data?: {
    category?: RawKmrsCategory[];
  };
};

type RawKmrsCategory = {
  cat_id?: string | number;
  category_uiid?: string;
  category_name?: string;
  item_list?: RawKmrsMenuItem[];
};

type RawKmrsMenuItem = {
  item_id?: string | number;
  item_uuid?: string;
  item_name?: string;
  item_description?: string;
  lowest_price_raw?: string | number;
  available?: boolean | string | number;
  item_unavailable?: string;
  price?: RawKmrsPrice[] | Record<string, RawKmrsPrice>;
};

type RawKmrsPrice = {
  final_price_raw?: string | number;
  price?: string | number;
  price_after_discount?: string | number;
};

export function createAccountingBridgeClient(options: AccountingBridgeClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const timeoutMs = options.timeoutMs ?? 10_000;

  return {
    async importMenu(snapshot: KmrsMenuSnapshotImport): Promise<AccountingMenuImportResponse> {
      return postAccountingJson(`${baseUrl}/v1/kmrs/import/menu`, snapshot, options.auth, timeoutMs);
    },
  };
}

export function createKmrsReadonlyClient(options: KmrsReadonlyClientOptions = {}) {
  const baseUrl = (options.baseUrl ?? "https://tagam.delivery").replace(/\/$/, "");
  const timeoutMs = options.timeoutMs ?? 8_000;
  const currencyCode = options.currencyCode ?? "TMT";

  return {
    async getStoreMenuSnapshot(input: {
      organizationId: string;
      locationId: string;
      restaurantSlug: string;
    }): Promise<KmrsMenuSnapshotImport> {
      const body = new URLSearchParams({
        slug: input.restaurantSlug,
        currency_code: currencyCode,
      });
      const response = await fetchWithTimeout(`${baseUrl}/interface/geStoreMenu`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body,
      }, timeoutMs);

      const envelope = (await response.json()) as KmrsEnvelope<RawKmrsMenuDetails>;

      if (!response.ok) {
        throw new Error(`KMRS menu request failed with HTTP ${response.status}`);
      }

      if (envelope.code && envelope.code !== 1 && envelope.code !== 3) {
        throw new Error(typeof envelope.msg === "string" ? envelope.msg : "KMRS menu request failed");
      }

      const details = envelope.details ?? {};
      const categories = details.data?.category ?? [];

      return {
        organizationId: input.organizationId,
        locationId: input.locationId,
        baseUrl,
        kmrsMerchantId: String(details.merchant_id ?? input.restaurantSlug),
        restaurantSlug: input.restaurantSlug,
        items: categories.flatMap((category) =>
          (category.item_list ?? []).map((item) => normalizeMenuItem(item, category, currencyCode))
        ),
        raw: envelope,
      };
    },
  };
}

export function signAccountingRequest(input: {
  method: string;
  pathWithQuery: string;
  body?: unknown;
  keyId: string;
  secret: string;
  timestamp?: string;
}) {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const canonical = [
    input.method.toUpperCase(),
    input.pathWithQuery,
    timestamp,
    sha256Hex(canonicalBody(input.body)),
  ].join("\n");
  const signature = createHmac("sha256", input.secret).update(canonical).digest("hex");

  return {
    "x-accounting-key-id": input.keyId,
    "x-accounting-timestamp": timestamp,
    "x-accounting-signature": `sha256=${signature}`,
  };
}

async function postAccountingJson<T>(
  url: string,
  body: unknown,
  auth: AccountingBridgeAuth,
  timeoutMs: number,
): Promise<T> {
  const parsedUrl = new URL(url);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (auth.mode === "api_key") {
    headers["x-api-key"] = auth.apiKey;
  } else {
    Object.assign(headers, signAccountingRequest({
      method: "POST",
      pathWithQuery: `${parsedUrl.pathname}${parsedUrl.search}`,
      body,
      keyId: auth.keyId,
      secret: auth.secret,
    }));
  }

  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }, timeoutMs);

  if (!response.ok) {
    throw new Error(`Accounting bridge request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeMenuItem(
  item: RawKmrsMenuItem,
  category: RawKmrsCategory,
  currencyCode: string,
): KmrsMenuItemImport {
  const prices = priceEntries(item.price);
  const price = Number(item.lowest_price_raw ?? prices[0]?.final_price_raw ?? prices[0]?.price_after_discount ?? prices[0]?.price ?? 0);
  const kmrsItemId = String(item.item_uuid ?? item.item_id ?? "");

  return {
    merchantId: "",
    kmrsItemId,
    categoryId: String(category.cat_id ?? category.category_uiid ?? ""),
    name: decodeHtml(String(item.item_name ?? "")),
    description: stripHtml(String(item.item_description ?? "")),
    ...(Number.isFinite(price) ? { price } : {}),
    currency: currencyCode,
    isAvailable: truthy(item.available ?? true) && !truthy(item.item_unavailable ?? false),
    raw: {
      item,
      category: {
        cat_id: category.cat_id,
        category_uiid: category.category_uiid,
        category_name: category.category_name,
      },
    },
  };
}

function priceEntries(value: RawKmrsMenuItem["price"]): RawKmrsPrice[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : Object.values(value);
}

function truthy(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value > 0;
  }

  return !["", "0", "false", "no", "null", "undefined"].includes(String(value).trim().toLowerCase());
}

function stripHtml(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

function canonicalBody(body: unknown): string {
  if (body === undefined || body === null) {
    return "";
  }

  return stableStringify(body);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
