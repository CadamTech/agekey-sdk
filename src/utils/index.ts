/**
 * @agekey/sdk - Utilities
 *
 * Re-export all utility functions.
 */

export { generateToken, generateState, generateNonce, validateState } from "./state";
export {
  decodeJwtPayload,
  extractAgeThresholds,
  extractSubject,
  extractNonce,
  isTokenExpired,
} from "./jwt";
export {
  isTestCredential,
  isTestSecret,
  validateCredentialEnvironments,
  getEnvironment,
} from "./environment";
