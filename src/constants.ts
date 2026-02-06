/**
 * @agekey/sdk - Constants
 *
 * API endpoints and configuration constants.
 */

/**
 * AgeKey API endpoints by environment.
 */
export const AGEKEY_ENDPOINTS = {
  test: {
    base: "https://api.test.agekey.org",
    use: "https://api.test.agekey.org/v1/oidc/use",
    create: "https://api.test.agekey.org/v1/oidc/create",
    par: "https://api.test.agekey.org/v1/oidc/create/par",
    jwks: "https://api.test.agekey.org/.well-known/jwks.json",
  },
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
 */
export const CREDENTIAL_PREFIXES = {
  testClientId: "ak_test_",
  liveClientId: "ak_live_",
  testSecret: "sk_test_",
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
