import type { FastifyRequest } from "fastify";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type AccountingAuthMode = "off" | "protected" | "strict";

export type AccountingAuthConfig = {
  mode: AccountingAuthMode;
  apiKeys: Map<string, string>;
  hmacSecrets: Map<string, string>;
  timestampToleranceSeconds: number;
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
  const hasCredentials = apiKeys.size > 0 || hmacSecrets.size > 0;
  const mode = parseAuthMode(env.ACCOUNTING_AUTH_MODE, hasCredentials);
  const timestampToleranceSeconds = Number.parseInt(env.ACCOUNTING_HMAC_TOLERANCE_SECONDS ?? "300", 10);

  return {
    mode,
    apiKeys,
    hmacSecrets,
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

function parseAuthMode(value: string | undefined, hasCredentials: boolean): AccountingAuthMode {
  if (value === "off" || value === "protected" || value === "strict") {
    return value;
  }

  return hasCredentials ? "protected" : "off";
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
