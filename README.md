# @openage-agekey/sdk

Official AgeKey SDK for age verification integration.

## Installation

```bash
npm i @openage-agekey/sdk
# or
pnpm add @openage-agekey/sdk
# or
yarn add @openage-agekey/sdk
```

### Upgrading (SSOT-related breaking changes)

Versions that removed the hard-coded **`AUTHORIZATION_PROVENANCE`** list and **`AuthorizationProvenance`** in favor of runtime SSOT fetchers are a **semver major** upgrade for consumers that imported those symbols. Replace them with **`fetchAuthorizationDetailSchema`**, **`fetchProvenanceConfig`**, and the helper functions documented under [Verification methods and provenance (SSOT)](#verification-methods-and-provenance-ssot).

## Quick Start

### Use AgeKey: Verify Age

Check if a user meets age requirements.

```typescript
import { AgeKey } from '@openage-agekey/sdk';

// Initialize the client
const agekey = new AgeKey({
  clientId: 'ak_test_xxxx',        // Your App ID
  redirectUri: 'https://myapp.com/callback',
});

// 1. Build authorization URL
const { url, state, nonce } = agekey.useAgeKey.getAuthorizationUrl({
  ageThresholds: [13, 18, 21],     // Ages to verify
  // provenance: { allowed: ['/connect_id'], denied: ['/legacy/*'] },  // Optional filter
});

// Store state/nonce in session (needed to validate callback)
session.ageKeyState = state;
session.ageKeyNonce = nonce;

// Redirect user to AgeKey
window.location.href = url;
```

```typescript
// 2. Handle callback (on your /callback route)
import { AgeKey, AccessDeniedError } from '@openage-agekey/sdk';

const agekey = new AgeKey({
  clientId: 'ak_test_xxxx',
  redirectUri: 'https://myapp.com/callback',
});

try {
  const result = agekey.useAgeKey.handleCallback(
    window.location.href,
    { state: session.ageKeyState, nonce: session.ageKeyNonce }
  );

  // Check age thresholds
  if (result.ageThresholds["18"]) {
    console.log("User is 18+");
  } else {
    console.log("User is under 18");
  }
} catch (error) {
  if (error instanceof AccessDeniedError) {
    console.log("User cancelled verification");
  }
}
```

### Create AgeKey: Store Age Verification

Store age verification signals for users (server-side only).

```typescript
import { AgeKey } from '@openage-agekey/sdk';

// Initialize with client secret (server-side only!)
const agekey = new AgeKey({
  clientId: 'ak_test_xxxx',
  clientSecret: 'sk_test_xxxx',    // Required for Create flow
  redirectUri: 'https://myapp.com/callback',
});

// 1. Initiate Create AgeKey flow
const { authUrl, requestUri, expiresIn } = await agekey.createAgeKey.initiate({
  method: 'id_doc_scan',           // Verification method used
  age: { date_of_birth: '2000-01-15' },
  verifiedAt: new Date(),
  verificationId: 'txn_123456',    // Your unique transaction ID
  provenance: '/connect_id',       // Required: origin of verification (see Provenance section)
});

// Redirect user to authUrl
res.redirect(authUrl);
```

```typescript
// 2. Handle callback
const result = agekey.createAgeKey.handleCallback(callbackUrl);

if (result.success) {
  console.log("AgeKey created successfully!");
} else {
  console.log("Error:", result.error);
}
```

### Upgrade Direct: Add Age Signal to Existing AgeKey

Add a new age signal to an existing AgeKey server-side, without WebAuthn. Requires the Use flow to be completed with `enableUpgrade: true`.

```typescript
import { AgeKey } from '@openage-agekey/sdk';

// Initialize with client secret (server-side only!)
const agekey = new AgeKey({
  clientId: 'ak_test_xxxx',
  clientSecret: 'sk_test_xxxx',
  redirectUri: 'https://myapp.com/callback',
});

// 1. Start Use flow with enableUpgrade
const { url, state, nonce } = agekey.useAgeKey.getAuthorizationUrl({
  ageThresholds: [18],
  enableUpgrade: true,
});
// Store state/nonce, redirect user to url...
```

```typescript
// 2. Handle callback — extract the authorization code
const result = agekey.useAgeKey.handleCallback(callbackUrl, { state, nonce });
const { code } = result; // present when enableUpgrade was used
```

```typescript
// 3. Exchange code for access token (server-side)
const { accessToken } = await agekey.upgradeDirect.exchangeCode(code);

// 4. Upgrade the AgeKey with a new age signal
const upgradeResult = await agekey.upgradeDirect.upgrade(accessToken, {
  method: 'id_doc_scan',
  age: { date_of_birth: '2000-01-15' },
  verifiedAt: new Date(),
  verificationId: 'txn_789',
  provenance: '/connect_id',
});

if (upgradeResult.success) {
  console.log("AgeKey upgraded successfully!");
}
```

## API Reference

### `AgeKey` Class

Main client class for all AgeKey operations.

```typescript
const agekey = new AgeKey({
  clientId: string,       // Required: Your App ID (ak_test_xxx or ak_live_xxx)
  clientSecret?: string,  // Optional: Your App Secret (server-side only)
  redirectUri: string,    // Required: Pre-registered callback URL
});
```

**Properties:**
- `agekey.useAgeKey` - Use AgeKey namespace
- `agekey.createAgeKey` - Create AgeKey namespace
- `agekey.upgradeDirect` - Upgrade Direct namespace
- `agekey.isTestMode` - Whether using test credentials
- `agekey.clientId` - The client ID
- `agekey.redirectUri` - The redirect URI

### Use AgeKey Namespace

#### `getAuthorizationUrl(options)`

Build an authorization URL to redirect the user.

```typescript
const { url, state, nonce } = agekey.useAgeKey.getAuthorizationUrl({
  ageThresholds: [18],            // Required: Ages to verify
  allowedMethods?: [...],         // Optional: Restrict verification methods
  verifiedAfter?: Date,           // Optional: Require recent verification
  overrides?: MethodOverridesMap, // Optional: per-method age_thresholds or min_age overrides
  provenance?: {                  // Optional: Filter by origin (allowed/denied patterns)
    allowed?: string[],
    denied?: string[],
  },
  enableCreate?: boolean,         // Optional: Show "create AgeKey" button if user has none
  enableUpgrade?: boolean,        // Optional: Allow upgrading an existing AgeKey
});
```

All method overrides accept an optional `age_thresholds` array that maps 1:1 to the root `ageThresholds` (by index). When using `overrides.facial_age_estimation`, **either `min_age` or `age_thresholds` is required** (per request-claims schema `oneOf`). The `FacialAgeEstimationOverride` type enforces this at compile time, and the SDK validates it at runtime.

#### `handleCallback(callbackUrl, validation)`

Validate the callback and extract age verification results.

```typescript
const result = agekey.useAgeKey.handleCallback(callbackUrl, { state, nonce });
// result.ageThresholds: { "18": true, "21": false }
// result.subject: "user_123" (optional)
// result.code: "abc123" (present when enableUpgrade was used)
// result.raw: { ... } (full JWT payload)
```

### Create AgeKey Namespace

#### `pushAuthorizationRequest(options)` (server-side)

Send a PAR request to initiate Create AgeKey flow.

```typescript
const { requestUri, expiresIn } = await agekey.createAgeKey.pushAuthorizationRequest({
  method: 'id_doc_scan',
  age: { date_of_birth: '2000-01-15' },
  verifiedAt: new Date(),
  verificationId: 'txn_123',
  attributes?: { ... },          // Optional: Method-specific attributes
  provenance: string,            // Required: origin of verification (load from SSOT; see Provenance)
  enableUpgrade?: boolean,       // Optional: Allow upgrading existing AgeKey
});
```

#### `getAuthorizationUrl(requestUri)`

Build authorization URL from PAR response.

```typescript
const url = agekey.createAgeKey.getAuthorizationUrl(requestUri);
```

#### `initiate(options)` (server-side)

Convenience method combining PAR + authorization URL.

```typescript
const { authUrl, requestUri, expiresIn } = await agekey.createAgeKey.initiate({
  method: 'id_doc_scan',
  age: { date_of_birth: '2000-01-15' },
  verifiedAt: new Date(),
  verificationId: 'txn_123',
  provenance: '/connect_id',   // Required — use SSOT helpers (see Provenance)
});
```

### Upgrade Direct Namespace

#### `exchangeCode(code)` (server-side)

Exchange an authorization code from the Use callback for an access token.

```typescript
const { accessToken, tokenType, expiresIn } = await agekey.upgradeDirect.exchangeCode(code);
```

#### `upgrade(accessToken, options)` (server-side)

Add an age signal to an existing AgeKey using an access token.

```typescript
const result = await agekey.upgradeDirect.upgrade(accessToken, {
  method: 'id_doc_scan',
  age: { date_of_birth: '2000-01-15' },
  verifiedAt: new Date(),
  verificationId: 'txn_123',
  provenance: '/connect_id',
  attributes?: { ... },          // Optional: Method-specific attributes
});
// result.success: true
```

## Error Handling

The SDK provides typed errors for common scenarios:

```typescript
import {
  AgeKeyError,           // Base error class
  StateMismatchError,    // CSRF protection triggered
  NonceMismatchError,    // Replay attack detected
  AccessDeniedError,     // User cancelled or denied
  InvalidTokenError,     // Malformed/expired token
  InvalidRequestError,   // Bad request parameters
  UnauthorizedClientError, // Invalid credentials
  ServerError,           // AgeKey server error
  NetworkError,          // Network connectivity issue
} from '@openage-agekey/sdk';

try {
  const result = agekey.useAgeKey.handleCallback(url, { state, nonce });
} catch (error) {
  if (error instanceof AccessDeniedError) {
    // User cancelled - show friendly message
  } else if (error instanceof StateMismatchError) {
    // Possible CSRF - restart flow
  } else if (error instanceof AgeKeyError) {
    // Other AgeKey error
    console.log(error.code, error.message, error.docsUrl);
  }
}
```

## Environment Detection

The SDK automatically detects test vs live environment from your credentials:

- `ak_test_*` / `sk_test_*` → Test environment
- `ak_live_*` / `sk_live_*` → Live environment

```typescript
const agekey = new AgeKey({ clientId: 'ak_test_xxx', ... });
console.log(agekey.isTestMode); // true
```

## Verification methods and provenance (SSOT)

Public metadata for verification **methods**, **provenance paths**, **digital-credential platforms**, and the **provenance bundle** (providers, methods per provider, jurisdictions) is published on **schemas.agekey.org**. The SSOT loader functions fetch that metadata so UIs and tooling can align with what the AgeKey API expects—without shipping a hard-coded list in your app.

These loaders are **helpers only**. They do not perform age verification and they are **not** a substitute for API-side validation. If the network fails or the JSON shape changes, handle errors and empty results in your own code.

### Default URLs

| Document | Constant | Purpose |
|----------|----------|---------|
| `authorization-detail.schema.json` | `DEFAULT_AUTHORIZATION_DETAIL_SCHEMA_URL` | JSON Schema: `provenance` enum, `$defs.methods`, `digital_credential_platforms`, … |
| `provenance-config.json` | `DEFAULT_PROVENANCE_CONFIG_URL` | SSOT bundle: provider paths, `methods` per provider, `jurisdictions`, `verification_methods` catalog |

### Schema vs provenance-config (which to use)

The two documents can differ over time (different publication pipelines). Use them for different jobs:

| Need | Prefer |
|------|--------|
| List of **verification method** ids (`id_doc_scan`, …) | `verificationMethodsFromAuthorizationDetailSchema` |
| List of **platform** values for `digital_credential` | `digitalCredentialPlatformsFromAuthorizationDetailSchema` |
| Flat list of **provenance** strings as in the published schema enum | `provenancePathsFromAuthorizationDetailSchema` |
| **Which provenance paths exist** as providers, **active** vs inactive, **which methods** a path supports, **jurisdictions** | `fetchProvenanceConfig` + `activeProviderPathsFromProvenanceConfig`, `providerPathsForMethodFromProvenanceConfig`, `methodsForProviderPathFromProvenanceConfig`, `verificationMethodKeysFromProvenanceConfig` |

For **Create / Upgrade** flows, the value you send as `provenance` must satisfy **both** the authorization-detail schema (and related rules) **and** the live provenance SSOT where the API enforces it. When in doubt, intersect lists from the schema and from `provenance-config`, or drive the UI from **provenance-config** and restrict by method using `providerPathsForMethodFromProvenanceConfig`.

### Caching and freshness

- Successful responses are cached **in memory per URL** for the lifetime of the process (or tab). There is **no built-in TTL**.
- Long-running servers or single-page apps that stay open for days may show **stale** method or provenance lists until you refetch. Mitigations: call **`clearSsotCache()`** then fetch again after deploys or on a timer; restart workers; or refetch on a schedule that matches your operational needs.
- The loader passes **`cache: 'force-cache'`** to `fetch` so normal **HTTP cache headers** from the CDN still apply at the network layer; the in-memory cache is stricter and does not revalidate automatically.

### Assumed JSON shape (drift and empty results)

Helpers read a **fixed** subset of the published JSON:

- Methods: `$defs.methods.enum`
- Digital credential platforms: `$defs.digital_credential_platforms.enum`
- Provenance strings from the schema: `properties.provenance.enum`

If the published documents change structure (for example enums move behind `allOf` or keys are renamed), these functions return **empty arrays** instead of throwing. Treat **empty** results as a signal to fix your integration or pin a **`url`** to a known-good document revision (see below).

### Security

- Only pass **`url`** values you **trust** (your own CDN mirror or AgeKey’s official host). Never pass user-controlled input as `url`—that would be **server-side request forgery (SSRF)** risk in Node and a redirect/open-proxy risk in some setups.
- **`fetchImpl`** should be your own `fetch` wrapper only when you need cookies, proxies, or test doubles—not arbitrary caller input.

### Pinning and staging

- Default URLs use the **`current/`** path so you always track the latest published metadata.
- For reproducible builds, compliance snapshots, or air-gapped mirrors, pass an explicit **`url`** to your **versioned** copy of the same files and optionally a custom **`fetchImpl`**.
- For staging, point **`url`** at your staging CDN; call **`clearSsotCache()`** when switching environments in the same process.

### TypeScript note

`VerificationMethod` is typed as **`string`**. Canonical values are only known at runtime from the SSOT helpers above; keep validation or allowlists in application code if you need stricter guarantees.

### Example: populate dropdowns (browser or server)

```typescript
import {
  fetchAuthorizationDetailSchema,
  fetchProvenanceConfig,
  verificationMethodsFromAuthorizationDetailSchema,
  provenancePathsFromAuthorizationDetailSchema,
  activeProviderPathsFromProvenanceConfig,
  providerPathsForMethodFromProvenanceConfig,
  clearSsotCache,
} from '@openage-agekey/sdk';

async function loadSsot() {
  const [schema, provCfg] = await Promise.all([
    fetchAuthorizationDetailSchema(),
    fetchProvenanceConfig(),
  ]);

  const methods = verificationMethodsFromAuthorizationDetailSchema(schema);
  const provenanceFromSchema = provenancePathsFromAuthorizationDetailSchema(schema);
  const activeProviders = activeProviderPathsFromProvenanceConfig(provCfg);
  const providersForDigitalCred = providerPathsForMethodFromProvenanceConfig(
    provCfg,
    'digital_credential',
  );

  // After a known SSOT rollout, optionally force a refetch:
  // clearSsotCache(); await loadSsot();

  return { methods, provenanceFromSchema, activeProviders, providersForDigitalCred };
}
```

Optional: `{ url: '...', fetchImpl: myFetch }` on each fetch for staging, tests, or older Node without global `fetch`. Call **`clearSsotCache()`** after tests or when you need to discard cached JSON.

## Provenance

**Provenance** identifies the origin of the age verification technology. The SDK supports it in both flows.

### Create AgeKey: Setting provenance

Each age signal you create **must** include a provenance value; it is required by the authorization-detail schema and the SDK does not default it.

Build allowlists using the SSOT section above: prefer **intersecting** schema enums with **provenance-config** active providers (and method compatibility) so the user can only pick combinations the API will accept.

```typescript
import { AgeKey, fetchAuthorizationDetailSchema, provenancePathsFromAuthorizationDetailSchema } from '@openage-agekey/sdk';

const schema = await fetchAuthorizationDetailSchema();
const allowedProvenance = provenancePathsFromAuthorizationDetailSchema(schema);
if (allowedProvenance.length === 0) {
  throw new Error('SSOT schema returned no provenance enum; check document shape or url');
}

const { authUrl } = await agekey.createAgeKey.initiate({
  method: 'digital_credential',
  age: { at_least_years: 18 },
  verifiedAt: new Date(),
  verificationId: 'txn_abc',
  provenance: '/veratad/roc',   // must satisfy live API + schema + provenance SSOT
});
```

### Use AgeKey: Filtering by provenance

When verifying age (Use flow), you can restrict which age signals are accepted by **allowed** and **denied** provenance patterns (request-claims schema). Denied takes precedence over allowed. Use a `*` suffix for prefix matching (e.g. `'/veratad/*'`).

```typescript
const { url, state, nonce } = agekey.useAgeKey.getAuthorizationUrl({
  ageThresholds: [18],
  provenance: {
    allowed: ['/connect_id', '/veratad/*'],   // Only accept these origins (max 10)
    denied: ['/legacy/*'],                    // Exclude these (max 10)
  },
});
```

If you omit `provenance`, all provenances are accepted (no filter).

## Method Overrides

When verifying age (Use flow), you can provide per-method overrides. Each override can include `min_age`, `age_thresholds`, `verified_after`, and `attributes`.

`age_thresholds` maps 1:1 to the root `ageThresholds` by index: `override.age_thresholds[i]` is the minimum age *for that method* needed to satisfy root threshold `i`. Its length must equal the root `ageThresholds` length.

```typescript
const { url, state, nonce } = agekey.useAgeKey.getAuthorizationUrl({
  ageThresholds: [13, 18],
  overrides: {
    // facial_age_estimation requires either min_age or age_thresholds (oneOf)
    facial_age_estimation: {
      min_age: 20,                         // raise the bar for this method
      attributes: { on_device: true },
    },
    // age_thresholds example: [15, 20] means this method needs 15+ for the 13 threshold, 20+ for the 18 threshold
    payment_card_network: {
      age_thresholds: [15, 20],
    },
  },
});
```

## Age Formats

When creating an AgeKey, specify age in one of these formats:

```typescript
// Exact date of birth
age: { date_of_birth: '2000-01-15' }

// Exact years
age: { years: 24 }

// At least N years (minimum age)
age: { at_least_years: 21 }
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  AgeKeyConfig,
  UseAgeKeyOptions,
  UseAgeKeyResult,
  CreateAgeKeyOptions,
  PARResult,
  UpgradeDirectOptions,
  ExchangeTokenResult,
  UpgradeDirectResult,
  VerificationMethod,
  AgeSpec,
  MethodOverride,
  MethodOverridesMap,
  FacialAgeEstimationOverride,
  ProvenanceConfigDocument,
  AuthorizationDetailSchema,
} from '@openage-agekey/sdk';
import {
  fetchProvenanceConfig,
  fetchAuthorizationDetailSchema,
  provenancePathsFromAuthorizationDetailSchema,
} from '@openage-agekey/sdk';
```

## Documentation

- [AgeKey Documentation](https://docs.agekey.org)
- [Quickstart Guide](https://docs.agekey.org/quickstart)
- [API Reference](https://docs.agekey.org/api-reference)
- [Troubleshooting](https://docs.agekey.org/troubleshooting)

## License

MIT
