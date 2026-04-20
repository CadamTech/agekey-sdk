/**
 * Load canonical verification / provenance metadata from schemas.agekey.org (SSOT).
 *
 * Mirrors the approach used by agekey-demo: public CloudFront URLs, browser-safe CORS,
 * optional URL overrides for staging. Uses in-memory caching per URL.
 */

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

/** Public provenance bundle (providers, methods, jurisdictions). */
export const DEFAULT_PROVENANCE_CONFIG_URL =
  "https://schemas.agekey.org/provenance/current/provenance-config.json";

/** authorization-detail.schema.json (method enum, provenance enum, platform enum, …). */
export const DEFAULT_AUTHORIZATION_DETAIL_SCHEMA_URL =
  "https://schemas.agekey.org/authorization-schemas/current/authorization-detail.schema.json";

// ---------------------------------------------------------------------------
// JSON shapes (subset used by helpers)
// ---------------------------------------------------------------------------

export type FetchLike = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>;

export interface SsotFetchOptions {
  /** Override the default SSOT URL. */
  url?: string;
  /** Inject fetch (Node without global fetch, tests, etc.). */
  fetchImpl?: FetchLike;
}

export interface AuthorizationDetailSchema {
  $id?: string;
  properties?: Record<string, unknown>;
  $defs?: Record<string, { enum?: unknown[] } & Record<string, unknown>>;
  [key: string]: unknown;
}

export interface ProvenanceProviderEntry {
  label?: string;
  website?: string;
  status?: string;
  jurisdictions?: string[];
  methods?: string[];
  [key: string]: unknown;
}

/** Raw provenance-config.json from S3 (providers keyed by path). */
export interface ProvenanceConfigDocument {
  version?: number;
  updated_at?: string;
  verification_methods?: Record<string, unknown>;
  providers?: Record<string, ProvenanceProviderEntry>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const provenanceCache = new Map<string, Promise<ProvenanceConfigDocument>>();
const authDetailSchemaCache = new Map<string, Promise<AuthorizationDetailSchema>>();

/** Clear cached SSOT fetches (mainly for tests). */
export function clearSsotCache(): void {
  provenanceCache.clear();
  authDetailSchemaCache.clear();
}

function getFetch(impl?: FetchLike): FetchLike {
  const f = impl ?? globalThis.fetch;
  if (typeof f !== "function") {
    throw new Error(
      "fetch is not available; pass fetchImpl in options (Node < 18 or restricted environments)."
    );
  }
  return f as FetchLike;
}

async function cachedJsonFetch<T>(
  cache: Map<string, Promise<T>>,
  url: string,
  label: string,
  fetchImpl: FetchLike
): Promise<T> {
  const hit = cache.get(url);
  if (hit) return hit;

  const pending = (async () => {
    const res = await fetchImpl(url, { cache: "force-cache" });
    if (!res.ok) {
      throw new Error(`${label} fetch failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  })();

  cache.set(url, pending);
  try {
    return await pending;
  } catch (e) {
    cache.delete(url);
    throw e;
  }
}

/**
 * Fetch provenance-config.json (provider paths, methods, jurisdictions).
 * Cached per URL until {@link clearSsotCache} or process restart.
 */
export async function fetchProvenanceConfig(
  options?: SsotFetchOptions
): Promise<ProvenanceConfigDocument> {
  const url = options?.url ?? DEFAULT_PROVENANCE_CONFIG_URL;
  return cachedJsonFetch(
    provenanceCache,
    url,
    "provenance-config",
    getFetch(options?.fetchImpl)
  );
}

/**
 * Fetch authorization-detail.schema.json (enums for methods, provenance, platforms).
 * Cached per URL until {@link clearSsotCache} or process restart.
 */
export async function fetchAuthorizationDetailSchema(
  options?: SsotFetchOptions
): Promise<AuthorizationDetailSchema> {
  const url = options?.url ?? DEFAULT_AUTHORIZATION_DETAIL_SCHEMA_URL;
  return cachedJsonFetch(
    authDetailSchemaCache,
    url,
    "authorization-detail.schema",
    getFetch(options?.fetchImpl)
  );
}

// ---------------------------------------------------------------------------
// authorization-detail.schema.json helpers
// ---------------------------------------------------------------------------

function enumFromDef(
  schema: AuthorizationDetailSchema,
  defName: string
): string[] {
  const def = schema?.$defs?.[defName];
  const values = def?.enum;
  return Array.isArray(values)
    ? values.filter((v): v is string => typeof v === "string")
    : [];
}

/** Canonical verification-method ids from `$defs.methods`. */
export function verificationMethodsFromAuthorizationDetailSchema(
  schema: AuthorizationDetailSchema
): string[] {
  return enumFromDef(schema, "methods");
}

/** `attributes.platform` values for `digital_credential` from `$defs.digital_credential_platforms`. */
export function digitalCredentialPlatformsFromAuthorizationDetailSchema(
  schema: AuthorizationDetailSchema
): string[] {
  return enumFromDef(schema, "digital_credential_platforms");
}

/** Allowed `provenance` strings from `properties.provenance.enum` (if present). */
export function provenancePathsFromAuthorizationDetailSchema(
  schema: AuthorizationDetailSchema
): string[] {
  const prov = schema.properties?.["provenance"] as
    | { enum?: unknown[] }
    | undefined;
  const values = prov?.enum;
  return Array.isArray(values)
    ? values.filter((v): v is string => typeof v === "string")
    : [];
}

// ---------------------------------------------------------------------------
// provenance-config.json helpers (providers object)
// ---------------------------------------------------------------------------

function isActiveProvider(entry: ProvenanceProviderEntry | undefined): boolean {
  if (!entry) return false;
  const s = entry.status;
  return s === undefined || s === "" || s === "active";
}

/** Sorted paths of active providers. */
export function activeProviderPathsFromProvenanceConfig(
  cfg: ProvenanceConfigDocument
): string[] {
  const providers = cfg.providers ?? {};
  return Object.keys(providers)
    .filter((path) => isActiveProvider(providers[path]))
    .sort();
}

export function providerEntryFromProvenanceConfig(
  cfg: ProvenanceConfigDocument,
  path: string
): ProvenanceProviderEntry | undefined {
  return cfg.providers?.[path];
}

/** Provider paths that declare the given method and are active. */
export function providerPathsForMethodFromProvenanceConfig(
  cfg: ProvenanceConfigDocument,
  method: string
): string[] {
  const providers = cfg.providers ?? {};
  const out: string[] = [];
  for (const [path, meta] of Object.entries(providers)) {
    if (!isActiveProvider(meta)) continue;
    const methods = meta.methods ?? [];
    if (methods.includes(method)) out.push(path);
  }
  return out.sort();
}

/** Methods supported by an active provider at `path`. */
export function methodsForProviderPathFromProvenanceConfig(
  cfg: ProvenanceConfigDocument,
  path: string
): string[] {
  const meta = cfg.providers?.[path];
  if (!isActiveProvider(meta)) return [];
  const m = meta?.methods;
  return Array.isArray(m) ? [...m] : [];
}

/** Keys from `verification_methods` (catalog), sorted. */
export function verificationMethodKeysFromProvenanceConfig(
  cfg: ProvenanceConfigDocument
): string[] {
  return Object.keys(cfg.verification_methods ?? {}).sort();
}
