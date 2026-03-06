import { SCOPES, RESPONSE_TYPES, DEFAULTS } from "./constants";
import { generateToken } from "./utils";
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

export class CreateAgeKeyClient {
  private readonly config: AgeKeyConfig;
  private readonly environment: Environment;

  constructor(config: AgeKeyConfig, environment: Environment) {
    this.config = config;
    this.environment = environment;
  }

  async pushAuthorizationRequest(
    options: CreateAgeKeyOptions
  ): Promise<PARResult> {
    if (!this.config.clientSecret) {
      throw new InvalidRequestError(
        "Client secret is required for Create AgeKey flow. " +
          "This method must be called server-side."
      );
    }

    const state = generateToken();
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

      if (!response.ok || data.error) {
        if (response.status === 401 || data.error === "unauthorized_client") {
          throw new UnauthorizedClientError(data.error_description);
        }
        if (data.error) {
          throw mapOidcError(data.error, data.error_description);
        }
        throw new ServerError(`PAR request failed: ${response.status}`);
      }
      if (!data.request_uri) {
        throw new ServerError("PAR response missing request_uri");
      }

      return {
        requestUri: data.request_uri,
        expiresIn: data.expires_in || DEFAULTS.parExpiry,
      };
    } catch (error) {
      if (error instanceof Error && error.name.includes("AgeKey")) {
        throw error;
      }
      throw new NetworkError("Failed to connect to AgeKey PAR endpoint", error);
    }
  }

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
    return { success: true };
  }

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
