/**
 * @agekey/sdk - Environment Detection
 *
 * Auto-detect test vs live environment from credentials.
 *
 * Key formats:
 * - Test keys: Always have ak_test_ prefix
 * - Live keys: May have ak_live_ prefix OR be legacy keys without prefix
 *
 * Legacy key formats (all treated as live):
 * - v2-{uuid} (e.g., v2-ec924bb1-68e9-4ccd-b1ac-e9116ca69ab7)
 * - devv2-{uuid}
 * - stagingv2-{uuid}
 * - prod-{name}
 */

import { AGEKEY_ENDPOINTS, CREDENTIAL_PREFIXES } from "../constants";
import type { Environment } from "../types";

/**
 * Detects whether a client ID is for test or live environment.
 *
 * Test mode is detected ONLY by the ak_test_ prefix.
 * All other keys (including legacy keys without prefix) are treated as live.
 *
 * @param clientId - The AgeKey client ID
 * @returns True if test environment
 *
 * @example
 * ```typescript
 * isTestCredential("ak_test_xxxx"); // true
 * isTestCredential("ak_live_xxxx"); // false
 * isTestCredential("v2-xxxx");      // false (legacy live key)
 * isTestCredential("devv2-xxxx");   // false (legacy dev key)
 * ```
 */
export function isTestCredential(clientId: string): boolean {
  // Only ak_test_ prefix indicates test mode
  // All other formats (including legacy) are treated as live
  return clientId.startsWith(CREDENTIAL_PREFIXES.testClientId);
}

/**
 * Detects whether a secret is for test or live environment.
 *
 * Test mode is detected by the sk_test_ prefix.
 * Legacy secrets (without prefix) are treated as live.
 *
 * @param secret - The AgeKey client secret
 * @returns True if test environment
 */
export function isTestSecret(secret: string): boolean {
  return secret.startsWith(CREDENTIAL_PREFIXES.testSecret);
}

/**
 * Strip sk_test_ or sk_live_ prefix from a secret if present.
 *
 * Use this when you need the raw 32-byte hex secret for cryptographic operations.
 * The prefix is purely for environment identification.
 *
 * @param secret - The secret (may or may not have prefix)
 * @returns The raw secret without prefix
 *
 * @example
 * ```typescript
 * stripSecretPrefix("sk_test_abc123..."); // "abc123..."
 * stripSecretPrefix("sk_live_abc123..."); // "abc123..."
 * stripSecretPrefix("abc123...");         // "abc123..." (legacy, no change)
 * ```
 */
export function stripSecretPrefix(secret: string): string {
  if (secret.startsWith(CREDENTIAL_PREFIXES.testSecret)) {
    return secret.slice(CREDENTIAL_PREFIXES.testSecret.length);
  }
  if (secret.startsWith(CREDENTIAL_PREFIXES.liveSecret)) {
    return secret.slice(CREDENTIAL_PREFIXES.liveSecret.length);
  }
  return secret;
}

/**
 * Check if a secret has a valid prefix (sk_test_ or sk_live_).
 *
 * @param secret - The secret to check
 * @returns True if the secret has a valid prefix
 */
export function hasSecretPrefix(secret: string): boolean {
  return (
    secret.startsWith(CREDENTIAL_PREFIXES.testSecret) ||
    secret.startsWith(CREDENTIAL_PREFIXES.liveSecret)
  );
}

/**
 * Validates that client ID and secret are from the same environment.
 *
 * Handles legacy secrets (without prefix) by skipping validation.
 * Only validates if the secret has a prefix (sk_test_ or sk_live_).
 *
 * @param clientId - The AgeKey client ID
 * @param clientSecret - The AgeKey client secret
 * @throws Error if environments don't match (when both have prefixes)
 */
export function validateCredentialEnvironments(
  clientId: string,
  clientSecret: string
): void {
  // Skip validation for legacy secrets (no prefix)
  if (!hasSecretPrefix(clientSecret)) {
    return;
  }

  const clientIsTest = isTestCredential(clientId);
  const secretIsTest = isTestSecret(clientSecret);

  if (clientIsTest !== secretIsTest) {
    throw new Error(
      `Environment mismatch: clientId is ${clientIsTest ? "test" : "live"} but clientSecret is ${secretIsTest ? "test" : "live"}. ` +
        `Both must be from the same environment.`
    );
  }
}

/**
 * Gets the full environment configuration based on client ID.
 *
 * @param clientId - The AgeKey client ID
 * @param apiBaseUrlOverride - Optional base URL override
 * @returns Environment configuration with all endpoints
 *
 * @example
 * ```typescript
 * const env = getEnvironment("ak_test_xxxx");
 * // env.useEndpoint = "https://api.test.agekey.org/v1/oidc/use"
 * ```
 */
export function getEnvironment(
  clientId: string,
  apiBaseUrlOverride?: string
): Environment {
  const isTest = isTestCredential(clientId);
  const endpoints = isTest ? AGEKEY_ENDPOINTS.test : AGEKEY_ENDPOINTS.live;

  if (apiBaseUrlOverride) {
    return {
      isTest,
      baseUrl: apiBaseUrlOverride,
      useEndpoint: `${apiBaseUrlOverride}/v1/oidc/use`,
      createEndpoint: `${apiBaseUrlOverride}/v1/oidc/create`,
      parEndpoint: `${apiBaseUrlOverride}/v1/oidc/create/par`,
    };
  }

  return {
    isTest,
    baseUrl: endpoints.base,
    useEndpoint: endpoints.use,
    createEndpoint: endpoints.create,
    parEndpoint: endpoints.par,
  };
}
