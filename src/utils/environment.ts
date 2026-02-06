/**
 * @agekey/sdk - Environment Detection
 *
 * Auto-detect test vs live environment from credentials.
 */

import { AGEKEY_ENDPOINTS, CREDENTIAL_PREFIXES } from "../constants";
import type { Environment } from "../types";

/**
 * Detects whether a client ID is for test or live environment.
 *
 * @param clientId - The AgeKey client ID
 * @returns True if test environment
 *
 * @example
 * ```typescript
 * isTestCredential("ak_test_xxxx"); // true
 * isTestCredential("ak_live_xxxx"); // false
 * ```
 */
export function isTestCredential(clientId: string): boolean {
  return clientId.startsWith(CREDENTIAL_PREFIXES.testClientId);
}

/**
 * Detects whether a secret is for test or live environment.
 *
 * @param secret - The AgeKey client secret
 * @returns True if test environment
 */
export function isTestSecret(secret: string): boolean {
  return secret.startsWith(CREDENTIAL_PREFIXES.testSecret);
}

/**
 * Validates that client ID and secret are from the same environment.
 *
 * @param clientId - The AgeKey client ID
 * @param clientSecret - The AgeKey client secret
 * @throws Error if environments don't match
 */
export function validateCredentialEnvironments(
  clientId: string,
  clientSecret: string
): void {
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
