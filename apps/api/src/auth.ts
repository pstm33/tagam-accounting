import type { FastifyRequest } from "fastify";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type AccountingAuthMode = "off" | "protected" | "strict";

export type AccountingAuthConfig = {
  mode: AccountingAuthMode;
  apiKeys: Map<string, string>;
  hmacSecrets: Map<string, string>;
  bridgeScopes: Map<string, BridgePrincipalScope>;
  timestampToleranceSeconds: number;
};

export type BridgePrincipalScope = {
  allowAll?: boolean;
  organizationIds?: string[];
  locationIds?: string[];
  baseUrls?: string[];
  restaurantSlugs?: string[];
  kmrsMerchantIds?: string[];
  kmrsConnectionIds?: string[];
};

export type BridgeScopeTarget = {
  organizationId?: string;
  locationId?: string;
  baseUrl?: string;
  restaurantSlug?: string;
  kmrsMerchantId?: string;
  kmrsConnectionId?: string;
};

export type BridgeScopeOptions = {
  require?: Array<keyof BridgeScopeTarget>;
};

export type AuthResult =
  | {
      ok: true;
      principal: string;
      method: "api_key" | "hmac";
    }
  | {
      ok: false;
      reason: string;
    };

const protectedRoutes = [
  { method: "POST", path: "/v1/bootstrap" },
  { method: "POST", path: "/v1/products" },
  { method: "GET", path: "/v1/kmrs/menu-items" },
  { method: "GET", path: "/v1/kmrs/sync-runs" },
  { method: "POST", path: "/v1/kmrs/orders/commit-writeoff" },
  { method: "POST", pathPrefix: "/v1/kmrs/import/" },
];

const publicRoutes = [
  { method: "GET", path: "/" },
  { method: "GET", path: "/health" },
  { method: "GET", path: "/v1/demo" },
  { method: "POST", path: "/v1/kmrs/orders/preview-writeoff" },
];

export function createAuthConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AccountingAuthConfig {
  const apiKeys = parseSecretList(env.ACCOUNTING_API_KEYS);
  const hmacSecrets = parseSecretList(env.ACCOUNTING_HMAC_SECRETS);
  const bridgeScopes = parseBridgeScopes(env.ACCOUNTING_BRIDGE_SCOPES);
  const hasCredentials = apiKeys.size > 0 || hmacSecrets.size > 0;
  const mode = parseAuthMode(env.ACCOUNTING_AUTH_MODE, hasCredentials);
  const timestampToleranceSeconds = Number.parseInt(env.ACCOUNTING_HMAC_TOLERANCE_SECONDS ?? "300", 10);

  return {
    mode,
    apiKeys,
    hmacSecrets,
    bridgeScopes,
    timestampToleranceSeconds: Number.isFinite(timestampToleranceSeconds) ? timestampToleranceSeconds : 300,
  };
}

export function routeRequiresAuth(request: FastifyRequest, config: AccountingAuthConfig): boolean {
  if (config.mode === "off") {
    return false;
  }

  const method = request.method.toUpperCase();
  const path = request.url.split("?")[0] ?? request.url;

  if (publicRoutes.some((route) => route.method === method && route.path === path)) {
    return false;
  }

  if (config.mode === "strict") {
    return path.startsWith("/v1/");
  }

  return protectedRoutes.some((route) => {
    if (route.method !== method) {
      return false;
    }

    if ("pathPrefix" in route) {
      return path.startsWith(route.pathPrefix);
    }

    return route.path === path;
  });
}

export function verifyAccountingAuth(request: FastifyRequest, config: AccountingAuthConfig): AuthResult {
  const apiKeyResult = verifyApiKey(request, config);

  if (apiKeyResult.ok) {
    return apiKeyResult;
  }

  const hmacResult = verifyHmac(request, config);

  if (hmacResult.ok) {
    return hmacResult;
  }

  return { ok: false, reason: hmacResult.reason || apiKeyResult.reason };
}

export function getAccountingPrincipal(request: FastifyRequest): string | undefined {
  return getHeader(request, "x-accounting-principal");
}

export function getBridgeScopeDenial(
  config: AccountingAuthConfig,
  principal: string | undefined,
  target: BridgeScopeTarget,
  options: BridgeScopeOptions = {},
): string | undefined {
  if (config.mode === "off" || config.bridgeScopes.size === 0) {
    return undefined;
  }

  if (!principal) {
    return "Missing accounting principal";
  }

  const scope = config.bridgeScopes.get(principal);

  if (!scope) {
    return "This bridge credential has no restaurant scope";
  }

  if (scope.allowAll) {
    return undefined;
  }

  return (
    denyIfNotAllowed(scope.organizationIds, target.organizationId, "organizationId", options) ||
    denyIfNotAllowed(scope.locationIds, target.locationId, "locationId", options) ||
    denyIfNotAllowed(scope.baseUrls?.map(normalizeBaseUrl), normalizeOptional(target.baseUrl, normalizeBaseUrl), "baseUrl", options) ||
    denyIfNotAllowed(
      scope.restaurantSlugs?.map(normalizeSlug),
      normalizeOptional(target.restaurantSlug, normalizeSlug),
      "restaurantSlug",
      options,
    ) ||
    denyIfNotAllowed(scope.kmrsMerchantIds, target.kmrsMerchantId, "kmrsMerchantId", options) ||
    denyIfNotAllowed(scope.kmrsConnectionIds, target.kmrsConnectionId, "kmrsConnectionId", options)
  );
}

function parseAuthMode(value: string | undefined, hasCredentials: boolean): AccountingAuthMode {
  if (value === "off" || value === "protected" || value === "strict") {
    return value;
  }

  return hasCredentials ? "protected" : "off";
}

function parseBridgeScopes(value: string | undefined): Map<string, BridgePrincipalScope> {
  const result = new Map<string, BridgePrincipalScope>();

  if (!value?.trim()) {
    return result;
  }

  const parsed = JSON.parse(value) as Record<string, BridgePrincipalScope>;

  for (const [principal, scope] of Object.entries(parsed)) {
    result.set(principal, {
      allowAll: scope.allowAll === true,
      ...(scope.organizationIds !== undefined ? { organizationIds: normalizedList(scope.organizationIds) } : {}),
      ...(scope.locationIds !== undefined ? { locationIds: normalizedList(scope.locationIds) } : {}),
      ...(scope.baseUrls !== undefined ? { baseUrls: normalizedList(scope.baseUrls).map(normalizeBaseUrl) } : {}),
      ...(scope.restaurantSlugs !== undefined ? { restaurantSlugs: normalizedList(scope.restaurantSlugs).map(normalizeSlug) } : {}),
      ...(scope.kmrsMerchantIds !== undefined ? { kmrsMerchantIds: normalizedList(scope.kmrsMerchantIds) } : {}),
      ...(scope.kmrsConnectionIds !== undefined ? { kmrsConnectionIds: normalizedList(scope.kmrsConnectionIds) } : {}),
    });
  }

  return result;
}

function parseSecretList(value: string | undefined): Map<string, string> {
  const result = new Map<string, string>();

  for (const rawEntry of (value ?? "").split(",")) {
    const entry = rawEntry.trim();

    if (!entry) {
      continue;
    }

    const separator = entry.indexOf(":");

    if (separator === -1) {
      result.set("default", entry);
      continue;
    }

    const keyId = entry.slice(0, separator).trim();
    const secret = entry.slice(separator + 1).trim();

    if (keyId && secret) {
      result.set(keyId, secret);
    }
  }

  return result;
}

function normalizedList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((value) => String(value).trim()).filter(Boolean);
}

function denyIfNotAllowed(
  allowed: string[] | undefined,
  value: string | undefined,
  label: keyof BridgeScopeTarget,
  options: BridgeScopeOptions,
): string | undefined {
  if (!allowed || allowed.length === 0) {
    return undefined;
  }

  if (!value) {
    return options.require?.includes(label) ? `${label} is required for this bridge credential` : undefined;
  }

  return allowed.includes(value) ? undefined : `${label} is outside this bridge credential scope`;
}

function normalizeOptional(value: string | undefined, normalizer: (input: string) => string): string | undefined {
  return value ? normalizer(value) : undefined;
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, "").toLowerCase();
}

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

function verifyApiKey(request: FastifyRequest, config: AccountingAuthConfig): AuthResult {
  if (config.apiKeys.size === 0) {
    return { ok: false, reason: "No API keys are configured" };
  }

  const headerKey = getHeader(request, "x-api-key");
  const bearerKey = getBearerToken(getHeader(request, "authorization"));
  const candidate = headerKey || bearerKey;

  if (!candidate) {
    return { ok: false, reason: "Missing API key" };
  }

  for (const [keyId, secret] of config.apiKeys.entries()) {
    if (safeEqual(candidate, secret)) {
      return { ok: true, principal: keyId, method: "api_key" };
    }
  }

  return { ok: false, reason: "Invalid API key" };
}

function verifyHmac(request: FastifyRequest, config: AccountingAuthConfig): AuthResult {
  if (config.hmacSecrets.size === 0) {
    return { ok: false, reason: "No HMAC secrets are configured" };
  }

  const keyId = getHeader(request, "x-accounting-key-id");
  const timestamp = getHeader(request, "x-accounting-timestamp");
  const signature = normalizeSignature(getHeader(request, "x-accounting-signature"));

  if (!keyId || !timestamp || !signature) {
    return { ok: false, reason: "Missing HMAC headers" };
  }

  const secret = config.hmacSecrets.get(keyId);

  if (!secret) {
    return { ok: false, reason: "Unknown HMAC key id" };
  }

  const timestampMs = Date.parse(timestamp);

  if (!Number.isFinite(timestampMs)) {
    return { ok: false, reason: "Invalid HMAC timestamp" };
  }

  const driftSeconds = Math.abs(Date.now() - timestampMs) / 1000;

  if (driftSeconds > config.timestampToleranceSeconds) {
    return { ok: false, reason: "HMAC timestamp is outside tolerance" };
  }

  const bodyHash = sha256Hex(canonicalBody(request.body));
  const signingString = [
    request.method.toUpperCase(),
    request.url,
    timestamp,
    bodyHash,
  ].join("\n");
  const expected = createHmac("sha256", secret).update(signingString).digest("hex");

  if (!safeEqual(signature, expected)) {
    return { ok: false, reason: "Invalid HMAC signature" };
  }

  return { ok: true, principal: keyId, method: "hmac" };
}

function getHeader(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getBearerToken(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1];
}

function normalizeSignature(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.trim().replace(/^sha256=/i, "").toLowerCase();
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

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
