/**
 * @agekey/sdk - JWT Utilities
 *
 * Client-side JWT decoding for ID tokens.
 * Note: For production, validate JWT signatures server-side using JWKS.
 */

/**
 * Decodes a JWT payload without verifying the signature.
 * Use this only for extracting claims client-side; always verify server-side.
 *
 * @param token - The JWT string (header.payload.signature)
 * @returns Decoded payload as an object, or null if invalid
 *
 * @example
 * ```typescript
 * const payload = decodeJwtPayload(idToken);
 * if (payload) {
 *   console.log(payload.age_thresholds);
 * }
 * ```
 */
export function decodeJwtPayload(
  token: string
): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    if (!payload) {
      return null;
    }

    // Convert base64url to base64
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");

    // Decode base64
    let jsonPayload: string;
    if (typeof atob !== "undefined") {
      // Browser environment
      jsonPayload = atob(base64);
    } else if (typeof Buffer !== "undefined") {
      // Node.js environment
      jsonPayload = Buffer.from(base64, "base64").toString("utf-8");
    } else {
      return null;
    }

    return JSON.parse(jsonPayload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Extracts age thresholds from a decoded JWT payload.
 *
 * @param payload - Decoded JWT payload
 * @returns Age thresholds map or null if not present
 *
 * @example
 * ```typescript
 * const thresholds = extractAgeThresholds(payload);
 * // { "13": true, "18": true, "21": false }
 * ```
 */
export function extractAgeThresholds(
  payload: Record<string, unknown>
): Record<string, boolean> | null {
  const ageThresholds = payload["age_thresholds"];
  if (typeof ageThresholds === "object" && ageThresholds !== null) {
    return ageThresholds as Record<string, boolean>;
  }
  return null;
}

/**
 * Extracts the subject (user ID) from a decoded JWT payload.
 *
 * @param payload - Decoded JWT payload
 * @returns Subject string or undefined
 */
export function extractSubject(
  payload: Record<string, unknown>
): string | undefined {
  const sub = payload["sub"];
  return typeof sub === "string" ? sub : undefined;
}

/**
 * Extracts the nonce from a decoded JWT payload.
 *
 * @param payload - Decoded JWT payload
 * @returns Nonce string or undefined
 */
export function extractNonce(
  payload: Record<string, unknown>
): string | undefined {
  const nonce = payload["nonce"];
  return typeof nonce === "string" ? nonce : undefined;
}

/**
 * Checks if a JWT has expired based on its `exp` claim.
 *
 * @param payload - Decoded JWT payload
 * @returns True if expired or no exp claim
 */
export function isTokenExpired(payload: Record<string, unknown>): boolean {
  const exp = payload["exp"];
  if (typeof exp !== "number") {
    return true; // No expiration claim = treat as expired
  }
  const now = Math.floor(Date.now() / 1000);
  return now >= exp;
}
