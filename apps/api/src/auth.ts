import type { FastifyRequest } from "fastify";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type AccountingAuthMode = "off" | "protected" | "strict";

export type AccountingAuthConfig = {
  mode: AccountingAuthMode;
  apiKeys: Map<string, string>;
  hmacSecrets: Map<string, string>;
  bridgeScopes: Map<string, BridgePrincipalScope>;
  timestampToleranceSeconds: number;
  webLogin?: WebLoginConfig;
};

export type WebLoginConfig = {
  username: string;
  password: string;
  sessionSecret: string;
  principal: string;
  maxAgeSeconds: number;
  cookieSecure: boolean;
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
      method: "api_key" | "hmac" | "web_session";
    }
  | {
      ok: false;
      reason: string;
    };

const protectedRoutes = [
  { method: "POST", path: "/v1/bootstrap" },
  { method: "POST", path: "/v1/products" },
  { method: "POST", path: "/v1/product-categories" },
  { method: "GET", path: "/v1/suppliers" },
  { method: "POST", path: "/v1/suppliers" },
  { method: "GET", path: "/v1/purchasing/overview" },
  { method: "POST", path: "/v1/purchasing/receipts" },
  { method: "POST", path: "/v1/recipes" },
  { method: "PATCH", pathPrefix: "/v1/recipes/" },
  { method: "POST", pathPrefix: "/v1/recipes/" },
  { method: "DELETE", pathPrefix: "/v1/recipes/" },
  { method: "GET", path: "/v1/kmrs/connections" },
  { method: "GET", path: "/v1/kmrs/menu-items" },
  { method: "POST", path: "/v1/kmrs/menu-items/link-suggested" },
  { method: "PUT", pathPrefix: "/v1/kmrs/menu-items/" },
  { method: "DELETE", pathPrefix: "/v1/kmrs/menu-items/" },
  { method: "GET", path: "/v1/kmrs/sync-runs" },
  { method: "POST", path: "/v1/kmrs/orders/commit-writeoff" },
  { method: "POST", pathPrefix: "/v1/kmrs/import/" },
];

const publicRoutes = [
  { method: "GET", path: "/" },
  { method: "GET", path: "/login" },
  { method: "POST", path: "/login" },
  { method: "POST", path: "/logout" },
  { method: "GET", path: "/health" },
  { method: "GET", path: "/v1/demo" },
  { method: "POST", path: "/v1/kmrs/orders/preview-writeoff" },
];

const webSessionCookieName = "tagam_accounting_session";

export function createAuthConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AccountingAuthConfig {
  const apiKeys = parseSecretList(env.ACCOUNTING_API_KEYS);
  const hmacSecrets = parseSecretList(env.ACCOUNTING_HMAC_SECRETS);
  const bridgeScopes = parseBridgeScopes(env.ACCOUNTING_BRIDGE_SCOPES);
  const hasCredentials = apiKeys.size > 0 || hmacSecrets.size > 0;
  const mode = parseAuthMode(env.ACCOUNTING_AUTH_MODE, hasCredentials);
  const timestampToleranceSeconds = Number.parseInt(env.ACCOUNTING_HMAC_TOLERANCE_SECONDS ?? "300", 10);
  const webLogin = parseWebLoginConfig(env, apiKeys, hmacSecrets);

  return {
    mode,
    apiKeys,
    hmacSecrets,
    bridgeScopes,
    timestampToleranceSeconds: Number.isFinite(timestampToleranceSeconds) ? timestampToleranceSeconds : 300,
    ...(webLogin !== undefined ? { webLogin } : {}),
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

  const webSessionResult = verifyWebSession(request, config);

  if (webSessionResult.ok) {
    return webSessionResult;
  }

  return { ok: false, reason: webSessionResult.reason || hmacResult.reason || apiKeyResult.reason };
}

export function verifyWebSession(request: FastifyRequest, config: AccountingAuthConfig): AuthResult {
  if (!config.webLogin) {
    return { ok: false, reason: "Web login is not configured" };
  }

  const token = getCookie(request, webSessionCookieName);

  if (!token) {
    return { ok: false, reason: "Missing web session" };
  }

  const [principalPart, expiresPart, signature] = token.split(".");

  if (!principalPart || !expiresPart || !signature) {
    return { ok: false, reason: "Invalid web session" };
  }

  const expiresAt = Number.parseInt(expiresPart, 10);

  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return { ok: false, reason: "Expired web session" };
  }

  const principal = base64UrlDecode(principalPart);
  const signingValue = `${principalPart}.${expiresPart}`;
  const expected = createHmac("sha256", config.webLogin.sessionSecret).update(signingValue).digest("hex");

  if (!safeEqual(signature, expected)) {
    return { ok: false, reason: "Invalid web session signature" };
  }

  if (principal !== config.webLogin.principal) {
    return { ok: false, reason: "Invalid web session principal" };
  }

  return { ok: true, principal, method: "web_session" };
}

export function verifyWebLogin(
  config: AccountingAuthConfig,
  input: { username?: string | undefined; password?: string | undefined },
): AuthResult {
  if (!config.webLogin) {
    return { ok: false, reason: "Web login is not configured" };
  }

  if (!input.username || !input.password) {
    return { ok: false, reason: "Missing username or password" };
  }

  if (!safeEqual(input.username, config.webLogin.username) || !safeEqual(input.password, config.webLogin.password)) {
    return { ok: false, reason: "Invalid username or password" };
  }

  return { ok: true, principal: config.webLogin.principal, method: "web_session" };
}

export function createWebSessionSetCookieHeader(config: AccountingAuthConfig): string {
  if (!config.webLogin) {
    throw new Error("Web login is not configured");
  }

  const expiresAt = Date.now() + config.webLogin.maxAgeSeconds * 1000;
  const principalPart = base64UrlEncode(config.webLogin.principal);
  const expiresPart = String(expiresAt);
  const signingValue = `${principalPart}.${expiresPart}`;
  const signature = createHmac("sha256", config.webLogin.sessionSecret).update(signingValue).digest("hex");
  const token = `${principalPart}.${expiresPart}.${signature}`;

  return [
    `${webSessionCookieName}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${config.webLogin.maxAgeSeconds}`,
    ...(config.webLogin.cookieSecure ? ["Secure"] : []),
  ].join("; ");
}

export function createWebSessionClearCookieHeader(config: AccountingAuthConfig): string {
  return [
    `${webSessionCookieName}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    ...(config.webLogin?.cookieSecure === true ? ["Secure"] : []),
  ].join("; ");
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

function parseWebLoginConfig(
  env: NodeJS.ProcessEnv,
  apiKeys: Map<string, string>,
  hmacSecrets: Map<string, string>,
): WebLoginConfig | undefined {
  const username = env.ACCOUNTING_WEB_USERNAME?.trim();
  const password = env.ACCOUNTING_WEB_PASSWORD?.trim();
  const explicitSessionSecret = env.ACCOUNTING_WEB_SESSION_SECRET?.trim();
  const fallbackSessionSecret = apiKeys.values().next().value ?? hmacSecrets.values().next().value;
  const sessionSecret = explicitSessionSecret || fallbackSessionSecret;

  if (!username || !password || !sessionSecret) {
    return undefined;
  }

  const maxAgeSeconds = Number.parseInt(env.ACCOUNTING_WEB_SESSION_MAX_AGE_SECONDS ?? "43200", 10);
  const principal = env.ACCOUNTING_WEB_PRINCIPAL?.trim() || apiKeys.keys().next().value || "web_admin";
  const cookieSecure = env.ACCOUNTING_WEB_COOKIE_SECURE !== "false";

  return {
    username,
    password,
    sessionSecret,
    principal,
    maxAgeSeconds: Number.isFinite(maxAgeSeconds) && maxAgeSeconds > 0 ? maxAgeSeconds : 43_200,
    cookieSecure,
  };
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

function getCookie(request: FastifyRequest, name: string): string | undefined {
  const header = getHeader(request, "cookie");

  if (!header) {
    return undefined;
  }

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    if (key === name) {
      return decodeURIComponent(value);
    }
  }

  return undefined;
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

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
