/**
 * @agekey/sdk - State & Nonce Utilities
 *
 * Cryptographically secure state and nonce generation for OIDC flows.
 */

import { DEFAULTS } from "../constants";

/**
 * Generates a cryptographically secure random token.
 * Works in both browser and Node.js environments.
 *
 * @param length - Number of random bytes (output will be 2x length in hex chars)
 * @returns Hex-encoded random string
 *
 * @example
 * ```typescript
 * const state = generateToken(); // "a1b2c3d4e5f6..."
 * ```
 */
export function generateToken(length: number = DEFAULTS.tokenLength): string {
  // Use Web Crypto API (works in browser and Node.js 15+)
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
      ""
    );
  }

  // Fallback for older Node.js (require crypto module)
  // This branch is mainly for compatibility; modern environments use Web Crypto
  throw new Error(
    "Crypto API not available. Please use a modern browser or Node.js 15+."
  );
}

/**
 * Generates a state parameter for OIDC authorization requests.
 * State is used to prevent CSRF attacks.
 *
 * @returns Cryptographically secure state string
 */
export function generateState(): string {
  return generateToken();
}

/**
 * Generates a nonce parameter for OIDC authorization requests.
 * Nonce is used to prevent replay attacks on ID tokens.
 *
 * @returns Cryptographically secure nonce string
 */
export function generateNonce(): string {
  return generateToken();
}

/**
 * Validates that a state parameter matches the expected value.
 *
 * @param received - State received in callback
 * @param expected - State sent in original request
 * @returns True if states match
 */
export function validateState(received: string, expected: string): boolean {
  if (!received || !expected) {
    return false;
  }
  // Constant-time comparison to prevent timing attacks
  if (received.length !== expected.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < received.length; i++) {
    result |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}
