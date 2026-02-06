/**
 * @agekey/sdk - Constants
 *
 * API endpoints and configuration constants.
 */

/**
 * AgeKey API endpoints.
 *
 * The SDK auto-detects the correct endpoint based on your client ID:
 * - `ak_test_*` keys → test endpoint (api-test.agekey.org)
 * - `ak_live_*` keys → live endpoint (api.agekey.org)
 *
 * For internal/development environments, use the `apiBaseUrl` config option.
 */
export const AGEKEY_ENDPOINTS = {
  /**
   * Test mode endpoint (for ak_test_* keys).
   * Used for development and testing without affecting production data.
   */
  test: {
    base: "https://api-test.agekey.org",
    use: "https://api-test.agekey.org/v1/oidc/use",
    create: "https://api-test.agekey.org/v1/oidc/create",
    par: "https://api-test.agekey.org/v1/oidc/create/par",
    jwks: "https://api-test.agekey.org/.well-known/jwks.json",
  },
  /**
   * Live mode endpoint (for ak_live_* keys).
   * Used for production with real user data.
   */
  live: {
    base: "https://api.agekey.org",
    use: "https://api.agekey.org/v1/oidc/use",
    create: "https://api.agekey.org/v1/oidc/create",
    par: "https://api.agekey.org/v1/oidc/create/par",
    jwks: "https://api.agekey.org/.well-known/jwks.json",
  },
} as const;

/**
 * Credential prefixes for environment detection.
 *
 * Note: Legacy live keys may not have the ak_live_ prefix.
 * All test keys have the ak_test_ prefix.
 */
export const CREDENTIAL_PREFIXES = {
  /** Test client ID prefix (always present for test keys) */
  testClientId: "ak_test_",
  /** Live client ID prefix (may be absent on legacy keys) */
  liveClientId: "ak_live_",
  /** Test secret prefix */
  testSecret: "sk_test_",
  /** Live secret prefix */
  liveSecret: "sk_live_",
} as const;

/**
 * Default configuration values.
 */
export const DEFAULTS = {
  /** Length of generated state/nonce tokens (in bytes, hex-encoded = 2x chars) */
  tokenLength: 32,
  /** PAR request_uri expiration (seconds) */
  parExpiry: 90,
} as const;

/**
 * OIDC scopes.
 */
export const SCOPES = {
  openid: "openid",
  upgrade: "openid agekey.upgrade",
} as const;

/**
 * OIDC response types.
 */
export const RESPONSE_TYPES = {
  idToken: "id_token",
  none: "none",
} as const;
