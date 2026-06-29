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
  LevelOfEffectiveness,
  Environment,
} from "./types";

// Map the SDK's snake_case level-of-effectiveness identifiers to the ISO labels
// the API expects on the wire (per request-claims.schema.json).
const LEVEL_OF_EFFECTIVENESS_WIRE: Record<LevelOfEffectiveness, string> = {
  basic: "Basic",
  effective: "Effective",
  highly_effective: "Highly Effective",
  strict: "Strict",
};

// Map an iso_27566_1 filter object's level_of_effectiveness to the ISO wire
// label, leaving `required` (and anything else) untouched.
function mapIsoToWire(iso: Record<string, unknown>): Record<string, unknown> {
  const mapped = { ...iso };
  const level = mapped["level_of_effectiveness"];
  if (typeof level === "string") {
    mapped["level_of_effectiveness"] = LEVEL_OF_EFFECTIVENESS_WIRE[level as LevelOfEffectiveness];
  }
  return mapped;
}

// Reads callback params from the URL fragment, with a deprecated query-string
// fallback. getAuthorizationUrl now requests response_mode=fragment, so the
// fragment is authoritative and takes precedence.
//
// @deprecated The query-string fallback exists only to bridge the rollout window
// where a client_id's server-side default still returns query. Once query is
// retired server-side, drop the `url.search` read and parse the fragment only.
function extractCallbackParams(callbackUrl: string): URLSearchParams {
  const url = new URL(callbackUrl);
  // DEPRECATED query fallback — remove once the server no longer returns query.
  const params = new URLSearchParams(url.search);
  if (url.hash.length > 1) {
    new URLSearchParams(url.hash.slice(1)).forEach((value, key) => {
      params.set(key, value);
    });
  }
  return params;
}

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
      // Map each override's nested iso_27566_1.level_of_effectiveness to the ISO
      // wire label; all other fields pass through unchanged.
      claims.overrides = Object.fromEntries(
        Object.entries(options.overrides).map(([method, override]) => {
          const o = { ...(override as Record<string, unknown>) };
          const iso = o["iso_27566_1"];
          if (iso && typeof iso === "object") {
            o["iso_27566_1"] = mapIsoToWire(iso as Record<string, unknown>);
          }
          return [method, o];
        })
      );
    }

    if (options.provenance && (options.provenance.allowed?.length || options.provenance.denied?.length)) {
      claims.provenance = options.provenance;
    }

    // ISO 27566-1 certification filter (root level; per-method overrides go
    // through `overrides` above and take precedence server-side).
    if (options.iso27566 && (options.iso27566.required || options.iso27566.levelOfEffectiveness)) {
      claims.iso_27566_1 = {};
      if (options.iso27566.required) {
        claims.iso_27566_1.required = true;
      }
      if (options.iso27566.levelOfEffectiveness) {
        claims.iso_27566_1.level_of_effectiveness =
          LEVEL_OF_EFFECTIVENESS_WIRE[options.iso27566.levelOfEffectiveness];
      }
    }

    // Build URL parameters
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: options.enableUpgrade ? RESPONSE_TYPES.upgrade : RESPONSE_TYPES.idToken,
      scope: options.enableUpgrade ? SCOPES.upgrade : SCOPES.openid,
      // fragment is the OIDC default for id_token responses; request it explicitly
      // so the response mode does not depend on per-client server defaults.
      response_mode: "fragment",
      state,
      nonce,
      claims: JSON.stringify(claims),
    });

    // Add optional can_create flag (explicitly emits both true and false)
    if (typeof options.enableCreate === "boolean") {
      params.set("can_create", String(options.enableCreate));
    }

    const url = `${this.environment.useEndpoint}?${params.toString()}`;

    return { url, state, nonce };
  }

  handleCallback(
    callbackUrl: string,
    validation: CallbackValidationParams
  ): UseAgeKeyResult {
    const params = extractCallbackParams(callbackUrl);

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
    const params = extractCallbackParams(callbackUrl);

    return {
      idToken: params.get("id_token"),
      code: params.get("code"),
      state: params.get("state"),
      error: params.get("error"),
      errorDescription: params.get("error_description"),
    };
  }
}
