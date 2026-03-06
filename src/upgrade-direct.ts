import {
  InvalidRequestError,
  UnauthorizedClientError,
  ServerError,
  NetworkError,
  mapOidcError,
} from "./errors";
import type {
  AgeKeyConfig,
  UpgradeDirectOptions,
  ExchangeTokenResult,
  UpgradeDirectResult,
  AuthorizationDetails,
  Environment,
} from "./types";

export class UpgradeDirectClient {
  private readonly config: AgeKeyConfig;
  private readonly environment: Environment;

  constructor(config: AgeKeyConfig, environment: Environment) {
    this.config = config;
    this.environment = environment;
  }

  /**
   * Exchange an authorization code (from the Use AgeKey callback) for an access token.
   * Requires `clientSecret` — must be called server-side.
   */
  async exchangeCode(code: string): Promise<ExchangeTokenResult> {
    if (!this.config.clientSecret) {
      throw new InvalidRequestError(
        "Client secret is required for token exchange. " +
          "This method must be called server-side."
      );
    }

    const credentials = btoa(
      `${this.config.clientId}:${this.config.clientSecret}`
    );

    const formData = new URLSearchParams({
      grant_type: "authorization_code",
      code,
    });

    try {
      const response = await fetch(this.environment.tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials}`,
        },
        body: formData.toString(),
      });

      const data = (await response.json()) as {
        access_token?: string;
        token_type?: string;
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
        throw new ServerError(`Token exchange failed: ${response.status}`);
      }

      if (!data.access_token) {
        throw new ServerError("Token response missing access_token");
      }

      return {
        accessToken: data.access_token,
        tokenType: data.token_type || "Bearer",
        expiresIn: data.expires_in || 0,
      };
    } catch (error) {
      if (error instanceof Error && error.name.includes("AgeKey")) {
        throw error;
      }
      throw new NetworkError(
        "Failed to connect to AgeKey token endpoint",
        error
      );
    }
  }

  /**
   * Add an age signal to an existing AgeKey using an access token.
   * The access token must have the `agekey.upgrade` scope.
   */
  async upgrade(
    accessToken: string,
    options: UpgradeDirectOptions
  ): Promise<UpgradeDirectResult> {
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

    try {
      const response = await fetch(this.environment.upgradeEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          authorization_details: JSON.stringify(authDetails),
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          error_description?: string;
          message?: string;
        };

        if (response.status === 401) {
          throw new UnauthorizedClientError(
            data.error || "invalid_token"
          );
        }
        if (response.status === 403) {
          throw new InvalidRequestError(
            data.error || "insufficient_scope"
          );
        }
        if (data.error) {
          throw mapOidcError(data.error, data.error_description);
        }
        throw new ServerError(
          `Upgrade request failed: ${response.status}`
        );
      }

      return { success: true };
    } catch (error) {
      if (error instanceof Error && error.name.includes("AgeKey")) {
        throw error;
      }
      throw new NetworkError(
        "Failed to connect to AgeKey upgrade endpoint",
        error
      );
    }
  }
}
