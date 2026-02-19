/**
 * @agekey/sdk - Create AgeKey
 *
 * Implements the "Create AgeKey" (Save) flow for storing age verification signals.
 * This flow uses OAuth 2.0 PAR (Pushed Authorization Requests).
 *
 * IMPORTANT: This flow requires the client secret and should only be used server-side.
 */

import { SCOPES, RESPONSE_TYPES, DEFAULTS } from "./constants";
import { generateState } from "./utils";
import {
  InvalidRequestError,
  UnauthorizedClientError,
  ServerError,
  NetworkError,
  mapOidcError,
} from "./errors";
import type {
  AgeKeyConfig,
  CreateAgeKeyOptions,
  PARResult,
  CreateAgeKeyResult,
  AuthorizationDetails,
  Environment,
} from "./types";

/**
 * Create AgeKey namespace for storing age verification signals.
 */
export class CreateAgeKeyClient {
  private readonly config: AgeKeyConfig;
  private readonly environment: Environment;

  constructor(config: AgeKeyConfig, environment: Environment) {
    this.config = config;
    this.environment = environment;
  }

  /**
   * Sends a PAR (Pushed Authorization Request) to initiate Create AgeKey flow.
   *
   * This method must be called server-side as it requires the client secret.
   *
   * @param options - Age verification data to store
   * @returns PAR result with request_uri for the authorization URL
   * @throws {InvalidRequestError} If required parameters are missing
   * @throws {UnauthorizedClientError} If credentials are invalid
   * @throws {ServerError} If the server returns an error
   * @throws {NetworkError} If a network error occurs
   *
   * @example
   * ```typescript
   * // Server-side only
   * const { requestUri, expiresIn } = await agekey.createAgeKey.pushAuthorizationRequest({
   *   method: 'id_doc_scan',
   *   age: { date_of_birth: '2000-01-15' },
   *   verifiedAt: new Date(),
   *   verificationId: 'txn_123456',
   * });
   *
   * // Use requestUri to build authorization URL
   * const authUrl = agekey.createAgeKey.getAuthorizationUrl(requestUri);
   * // Redirect user to authUrl
   * ```
   */
  async pushAuthorizationRequest(
    options: CreateAgeKeyOptions
  ): Promise<PARResult> {
    // Validate client secret is available
    if (!this.config.clientSecret) {
      throw new InvalidRequestError(
        "Client secret is required for Create AgeKey flow. " +
          "This method must be called server-side."
      );
    }

    // Generate state
    const state = generateState();

    // Build authorization_details (per authorization-detail.schema.json)
    // provenance is required by the schema (no default)
    const authDetails: AuthorizationDetails[] = [
      {
        type: "age_verification",
        method: options.method,
        age: options.age,
        verified_at: options.verifiedAt.toISOString(),
        verification_id: options.verificationId,
        provenance: options.provenance,
        ...(options.attributes && { attributes: options.attributes }),
      },
    ];

    // Build form data for PAR request
    const formData = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      response_type: RESPONSE_TYPES.none,
      scope: options.enableUpgrade ? SCOPES.upgrade : SCOPES.openid,
      state,
      authorization_details: JSON.stringify(authDetails),
    });

    try {
      const response = await fetch(this.environment.parEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const data = (await response.json()) as {
        request_uri?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
      };

      // Handle error responses
      if (!response.ok || data.error) {
        if (response.status === 401 || data.error === "unauthorized_client") {
          throw new UnauthorizedClientError(data.error_description);
        }
        if (data.error) {
          throw mapOidcError(data.error, data.error_description);
        }
        throw new ServerError(`PAR request failed: ${response.status}`);
      }

      // Validate response
      if (!data.request_uri) {
        throw new ServerError("PAR response missing request_uri");
      }

      return {
        requestUri: data.request_uri,
        expiresIn: data.expires_in || DEFAULTS.parExpiry,
      };
    } catch (error) {
      // Re-throw AgeKey errors
      if (error instanceof Error && error.name.includes("AgeKey")) {
        throw error;
      }
      // Wrap network errors
      throw new NetworkError("Failed to connect to AgeKey PAR endpoint", error);
    }
  }

  /**
   * Builds an authorization URL using a request_uri from PAR.
   *
   * @param requestUri - The request_uri from pushAuthorizationRequest()
   * @param options - Optional additional parameters
   * @returns Full authorization URL to redirect the user to
   *
   * @example
   * ```typescript
   * const authUrl = agekey.createAgeKey.getAuthorizationUrl(requestUri);
   * // Redirect user: res.redirect(authUrl)
   * ```
   */
  getAuthorizationUrl(
    requestUri: string,
    options?: { enableUpgrade?: boolean }
  ): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: RESPONSE_TYPES.none,
      scope: options?.enableUpgrade ? SCOPES.upgrade : SCOPES.openid,
      request_uri: requestUri,
    });

    if (options?.enableUpgrade) {
      params.set("can_upgrade", "true");
    }

    return `${this.environment.createEndpoint}?${params.toString()}`;
  }

  /**
   * Handles the callback from a Create AgeKey authorization.
   *
   * Note: Create AgeKey uses response_type=none, so no tokens are returned.
   * The callback only indicates success or failure.
   *
   * @param callbackUrl - The full callback URL
   * @returns Result indicating success or error
   *
   * @example
   * ```typescript
   * const result = agekey.createAgeKey.handleCallback(callbackUrl);
   * if (result.success) {
   *   console.log("AgeKey created successfully!");
   * } else {
   *   console.log("Error:", result.error, result.errorDescription);
   * }
   * ```
   */
  handleCallback(callbackUrl: string): CreateAgeKeyResult {
    const url = new URL(callbackUrl);
    const params = url.searchParams;

    const error = params.get("error");
    if (error) {
      return {
        success: false,
        error,
        errorDescription: params.get("error_description") || undefined,
      };
    }

    // No error = success (response_type=none means no tokens)
    return { success: true };
  }

  /**
   * Helper to build a complete Create AgeKey flow.
   * Combines PAR and authorization URL in one call.
   *
   * @param options - Age verification data
   * @returns Object with authUrl, requestUri, and state
   *
   * @example
   * ```typescript
   * const { authUrl, requestUri, expiresIn } = await agekey.createAgeKey.initiate({
   *   method: 'id_doc_scan',
   *   age: { date_of_birth: '2000-01-15' },
   *   verifiedAt: new Date(),
   *   verificationId: 'txn_123456',
   * });
   *
   * // Redirect user to authUrl
   * res.redirect(authUrl);
   * ```
   */
  async initiate(
    options: CreateAgeKeyOptions
  ): Promise<{ authUrl: string; requestUri: string; expiresIn: number }> {
    const parResult = await this.pushAuthorizationRequest(options);
    const authUrl = this.getAuthorizationUrl(parResult.requestUri, {
      enableUpgrade: options.enableUpgrade,
    });

    return {
      authUrl,
      requestUri: parResult.requestUri,
      expiresIn: parResult.expiresIn,
    };
  }
}
