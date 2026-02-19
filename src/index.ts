/**
 * @agekey/sdk - Official AgeKey SDK
 *
 * Simple, type-safe age verification for your application.
 *
 * @example
 * ```typescript
 * import { AgeKey } from '@agekey/sdk';
 *
 * const agekey = new AgeKey({
 *   clientId: 'ak_test_xxxx',
 *   redirectUri: 'https://myapp.com/callback',
 * });
 *
 * // Build authorization URL
 * const { url, state, nonce } = agekey.useAgeKey.getAuthorizationUrl({
 *   ageThresholds: [18],
 * });
 *
 * // Handle callback
 * const result = agekey.useAgeKey.handleCallback(callbackUrl, { state, nonce });
 * console.log(result.ageThresholds["18"]); // true or false
 * ```
 *
 * @packageDocumentation
 */

// Main client
export { AgeKey } from "./client";

// Sub-clients (for advanced use cases)
export { UseAgeKeyClient } from "./use-agekey";
export { CreateAgeKeyClient } from "./create-agekey";

// Error classes
export {
  AgeKeyError,
  StateMismatchError,
  NonceMismatchError,
  AccessDeniedError,
  InvalidTokenError,
  InvalidRequestError,
  UnauthorizedClientError,
  ServerError,
  NetworkError,
  mapOidcError,
} from "./errors";

// Types
export type {
  // Configuration
  AgeKeyConfig,
  // Use AgeKey
  UseAgeKeyOptions,
  AuthorizationUrlResult,
  CallbackValidationParams,
  UseAgeKeyResult,
  // Create AgeKey
  CreateAgeKeyOptions,
  PARResult,
  CreateAgeKeyResult,
  VerificationMethod,
  AgeSpec,
  AgeDateOfBirth,
  AgeYears,
  AgeAtLeastYears,
  AuthorizationProvenance,
  MethodOverride,
  FacialAgeEstimationOverride,
  MethodOverridesMap,
  // Errors
  AgeKeyErrorCode,
  // Internal (for advanced use)
  Environment,
} from "./types";
export { AUTHORIZATION_PROVENANCE } from "./types";

// Utilities (for advanced use cases)
export {
  generateToken,
  generateState,
  generateNonce,
  validateState,
  decodeJwtPayload,
  extractAgeThresholds,
  isTestCredential,
  isTestSecret,
  getEnvironment,
  stripSecretPrefix,
  hasSecretPrefix,
} from "./utils";

// Constants (for advanced use cases)
export { AGEKEY_ENDPOINTS, CREDENTIAL_PREFIXES } from "./constants";
