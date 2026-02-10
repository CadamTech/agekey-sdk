/**
 * @agekey/sdk - Use AgeKey
 *
 * Implements the "Use AgeKey" flow for verifying age against thresholds.
 * This is the primary flow for checking if a user meets age requirements.
 */

import { SCOPES, RESPONSE_TYPES } from "./constants";
import {
  generateState,
  generateNonce,
  validateState,
  decodeJwtPayload,
  extractAgeThresholds,
  extractSubject,
  extractNonce,
  isTokenExpired,
} from "./utils";
import {
  StateMismatchError,
  NonceMismatchError,
  InvalidTokenError,
  mapOidcError,
} from "./errors";
import type {
  AgeKeyConfig,
  UseAgeKeyOptions,
  AuthorizationUrlResult,
  CallbackValidationParams,
  UseAgeKeyResult,
  UseAgeKeyClaims,
  Environment,
} from "./types";

/**
 * Use AgeKey namespace for age verification flows.
 */
export class UseAgeKeyClient {
  private readonly config: AgeKeyConfig;
  private readonly environment: Environment;

  constructor(config: AgeKeyConfig, environment: Environment) {
    this.config = config;
    this.environment = environment;
  }

  /**
   * Builds an authorization URL for the Use AgeKey flow.
   *
   * @param options - Age verification options
   * @returns Authorization URL and security tokens to store
   *
   * @example
   * ```typescript
   * const { url, state, nonce } = agekey.useAgeKey.getAuthorizationUrl({
   *   ageThresholds: [13, 18, 21],
   * });
   *
   * // Store state and nonce in session
   * session.ageKeyState = state;
   * session.ageKeyNonce = nonce;
   *
   * // Redirect user
   * window.location.href = url;
   * ```
   */
  getAuthorizationUrl(options: UseAgeKeyOptions): AuthorizationUrlResult {
    const state = generateState();
    const nonce = generateNonce();

    // Build claims object (flat format per request-claims.schema.json)
    const claims: UseAgeKeyClaims = {
      age_thresholds: options.ageThresholds,
    };

    // Add optional allowed_methods
    if (options.allowedMethods && options.allowedMethods.length > 0) {
      claims.allowed_methods = options.allowedMethods;
    }

    // Add optional verified_after
    if (options.verifiedAfter) {
      // Format as ISO date string (YYYY-MM-DD) for the schema
      claims.verified_after = options.verifiedAfter.toISOString().split("T")[0];
    }

    // Add optional overrides
    if (options.overrides && Object.keys(options.overrides).length > 0) {
      claims.overrides = options.overrides;
    }

    if (options.provenance && (options.provenance.allowed?.length || options.provenance.denied?.length)) {
      claims.provenance = options.provenance;
    }

    // Build URL parameters
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: RESPONSE_TYPES.idToken,
      scope: options.enableCreate ? SCOPES.upgrade : SCOPES.openid,
      state,
      nonce,
      claims: JSON.stringify(claims),
    });

    // Add optional can_create flag
    if (options.enableCreate) {
      params.set("can_create", "true");
    }

    const url = `${this.environment.useEndpoint}?${params.toString()}`;

    return { url, state, nonce };
  }

  /**
   * Handles the callback from a Use AgeKey authorization.
   *
   * @param callbackUrl - The full callback URL (including query params)
   * @param validation - The state and nonce from the original request
   * @returns Parsed age verification result
   * @throws {StateMismatchError} If state doesn't match
   * @throws {NonceMismatchError} If nonce doesn't match
   * @throws {AccessDeniedError} If user denied the request
   * @throws {InvalidTokenError} If ID token is invalid
   *
   * @example
   * ```typescript
   * try {
   *   const result = agekey.useAgeKey.handleCallback(
   *     window.location.href,
   *     { state: session.ageKeyState, nonce: session.ageKeyNonce }
   *   );
   *
   *   if (result.ageThresholds["18"]) {
   *     console.log("User is 18+");
   *   }
   * } catch (error) {
   *   if (error instanceof AccessDeniedError) {
   *     console.log("User cancelled verification");
   *   }
   * }
   * ```
   */
  handleCallback(
    callbackUrl: string,
    validation: CallbackValidationParams
  ): UseAgeKeyResult {
    // Parse callback URL
    const url = new URL(callbackUrl);
    const params = url.searchParams;

    // Check for OIDC errors first
    const error = params.get("error");
    if (error) {
      const errorDescription = params.get("error_description") || undefined;
      throw mapOidcError(error, errorDescription);
    }

    // Validate state
    const receivedState = params.get("state");
    if (!receivedState || !validateState(receivedState, validation.state)) {
      throw new StateMismatchError();
    }

    // Get ID token
    const idToken = params.get("id_token");
    if (!idToken) {
      throw new InvalidTokenError("No ID token in callback");
    }

    // Decode token
    const payload = decodeJwtPayload(idToken);
    if (!payload) {
      throw new InvalidTokenError("Failed to decode ID token");
    }

    // Validate nonce
    const tokenNonce = extractNonce(payload);
    if (!tokenNonce || !validateState(tokenNonce, validation.nonce)) {
      throw new NonceMismatchError();
    }

    // Check expiration (optional, for extra security)
    if (isTokenExpired(payload)) {
      throw new InvalidTokenError("ID token has expired");
    }

    // Extract age thresholds
    const ageThresholds = extractAgeThresholds(payload);
    if (!ageThresholds) {
      throw new InvalidTokenError("No age_thresholds in ID token");
    }

    return {
      ageThresholds,
      subject: extractSubject(payload),
      raw: payload,
    };
  }

  /**
   * Parses callback parameters without full validation.
   * Useful for extracting error information or debugging.
   *
   * @param callbackUrl - The callback URL to parse
   * @returns Parsed parameters
   */
  parseCallback(callbackUrl: string): {
    idToken: string | null;
    state: string | null;
    error: string | null;
    errorDescription: string | null;
  } {
    const url = new URL(callbackUrl);
    const params = url.searchParams;

    return {
      idToken: params.get("id_token"),
      state: params.get("state"),
      error: params.get("error"),
      errorDescription: params.get("error_description"),
    };
  }
}
