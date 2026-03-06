import { SCOPES, RESPONSE_TYPES } from "./constants";
import { generateToken, decodeJwtPayload } from "./utils";
import {
  StateMismatchError,
  NonceMismatchError,
  InvalidTokenError,
  InvalidRequestError,
  mapOidcError,
} from "./errors";
import type {
  AgeKeyConfig,
  UseAgeKeyOptions,
  AuthorizationUrlResult,
  CallbackValidationParams,
  UseAgeKeyResult,
  UseAgeKeyClaims,
  MethodOverride,
  Environment,
} from "./types";

export class UseAgeKeyClient {
  private readonly config: AgeKeyConfig;
  private readonly environment: Environment;

  constructor(config: AgeKeyConfig, environment: Environment) {
    this.config = config;
    this.environment = environment;
  }

  getAuthorizationUrl(options: UseAgeKeyOptions): AuthorizationUrlResult {
    const state = generateToken();
    const nonce = generateToken();

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

    // Add optional overrides (request-claims: facial_age_estimation requires min_age OR age_thresholds)
    if (options.overrides && Object.keys(options.overrides).length > 0) {
      const facial = options.overrides.facial_age_estimation;
      if (facial !== undefined) {
        const f = facial as { min_age?: number; age_thresholds?: number[] };
        const hasMinAge = typeof f.min_age === "number";
        const hasAgeThresholds = Array.isArray(f.age_thresholds) && f.age_thresholds.length > 0;
        if (!hasMinAge && !hasAgeThresholds) {
          throw new InvalidRequestError(
            "overrides.facial_age_estimation requires either min_age or age_thresholds (per request-claims schema)"
          );
        }
      }
      claims.overrides = options.overrides as Record<string, MethodOverride>;
    }

    if (options.provenance && (options.provenance.allowed?.length || options.provenance.denied?.length)) {
      claims.provenance = options.provenance;
    }

    // Build URL parameters
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: options.enableUpgrade ? RESPONSE_TYPES.upgrade : RESPONSE_TYPES.idToken,
      scope: options.enableUpgrade ? SCOPES.upgrade : SCOPES.openid,
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

  handleCallback(
    callbackUrl: string,
    validation: CallbackValidationParams
  ): UseAgeKeyResult {
    // Parse callback URL
    const url = new URL(callbackUrl);
    const params = url.searchParams;

    const error = params.get("error");
    if (error) {
      const errorDescription = params.get("error_description") || undefined;
      throw mapOidcError(error, errorDescription);
    }

    const receivedState = params.get("state");
    if (!receivedState || receivedState !== validation.state) {
      throw new StateMismatchError();
    }

    const idToken = params.get("id_token");
    if (!idToken) {
      throw new InvalidTokenError("No ID token in callback");
    }

    const payload = decodeJwtPayload(idToken);
    if (!payload) throw new InvalidTokenError("Failed to decode ID token");

    const tokenNonce = payload["nonce"];
    if (typeof tokenNonce !== "string" || tokenNonce !== validation.nonce) {
      throw new NonceMismatchError();
    }

    const exp = payload["exp"];
    if (typeof exp !== "number" || Math.floor(Date.now() / 1000) >= exp) {
      throw new InvalidTokenError("ID token has expired");
    }

    const ageThresholds = payload["age_thresholds"];
    if (typeof ageThresholds !== "object" || ageThresholds === null) {
      throw new InvalidTokenError("No age_thresholds in ID token");
    }

    const code = params.get("code") || undefined;

    return {
      ageThresholds: ageThresholds as Record<string, boolean>,
      subject: typeof payload["sub"] === "string" ? payload["sub"] : undefined,
      code,
      raw: payload,
    };
  }

  parseCallback(callbackUrl: string): {
    idToken: string | null;
    code: string | null;
    state: string | null;
    error: string | null;
    errorDescription: string | null;
  } {
    const url = new URL(callbackUrl);
    const params = url.searchParams;

    return {
      idToken: params.get("id_token"),
      code: params.get("code"),
      state: params.get("state"),
      error: params.get("error"),
      errorDescription: params.get("error_description"),
    };
  }
}
