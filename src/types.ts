/**
 * @agekey/sdk - TypeScript Type Definitions
 *
 * Core types for the AgeKey SDK, providing type-safe age verification.
 */

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Configuration for initializing the AgeKey client.
 *
 * @example
 * ```typescript
 * const config: AgeKeyConfig = {
 *   clientId: 'ak_test_xxxx',
 *   clientSecret: 'sk_test_xxxx',
 *   redirectUri: 'https://myapp.com/callback',
 * };
 * ```
 */
export interface AgeKeyConfig {
  /**
   * Your AgeKey application ID.
   * Starts with `ak_test_` for test mode or `ak_live_` for production.
   */
  clientId: string;

  /**
   * Your AgeKey application secret (server-side only).
   * Starts with `sk_test_` or `sk_live_`.
   * Required for Create AgeKey flows.
   */
  clientSecret?: string;

  /**
   * The redirect URI for OIDC callbacks.
   * Must be pre-registered in the AgeKey Developer Portal.
   */
  redirectUri: string;

  /**
   * Override the API base URL.
   * Defaults to auto-detection based on clientId prefix.
   */
  apiBaseUrl?: string;
}

// =============================================================================
// Use AgeKey Types
// =============================================================================

/**
 * Options for building a Use AgeKey authorization URL.
 */
export interface UseAgeKeyOptions {
  /**
   * Age thresholds to verify against.
   * The response will indicate whether the user is at least each age.
   *
   * @example [13, 18, 21] // Verify if user is 13+, 18+, and 21+
   */
  ageThresholds: number[];

  /**
   * Allowed verification methods. If omitted, all methods are allowed.
   */
  allowedMethods?: VerificationMethod[];

  /**
   * Minimum date the verification must have occurred.
   * Use this to require recent verifications.
   */
  verifiedAfter?: Date;

  /**
   * Method-specific overrides for age verification (request-claims.schema.json).
   * facial_age_estimation requires either min_age or age_thresholds (oneOf).
   */
  overrides?: MethodOverridesMap;

  /**
   * Filter age signals by provenance (origin of verification technology).
   */
  provenance?: {
    allowed?: string[];
    denied?: string[];
  };

  /**
   * Enable upgrade flow: if user doesn't have an AgeKey, prompt to create one.
   */
  enableCreate?: boolean;

  /**
   * Additional state to include in the callback.
   * Will be returned unchanged in the callback URL.
   */
  customState?: Record<string, unknown>;


}

/**
 * Result from building an authorization URL.
 */
export interface AuthorizationUrlResult {
  /**
   * The full authorization URL to redirect the user to.
   */
  url: string;

  /**
   * The state parameter. Store this to validate the callback.
   */
  state: string;

  /**
   * The nonce parameter. Store this to validate the ID token.
   */
  nonce: string;
}

/**
 * Parameters for validating an OIDC callback.
 */
export interface CallbackValidationParams {
  /**
   * The state that was sent in the original request.
   */
  state: string;

  /**
   * The nonce that was sent in the original request.
   */
  nonce: string;
}

/**
 * Result from handling a Use AgeKey callback.
 */
export interface UseAgeKeyResult {
  /**
   * Age threshold results: key is the age, value is whether user meets it.
   *
   * @example { "13": true, "18": true, "21": false }
   */
  ageThresholds: Record<string, boolean>;

  /**
   * The user's unique identifier within AgeKey.
   */
  subject?: string;

  /**
   * Raw decoded ID token payload (for advanced use cases).
   */
  raw: Record<string, unknown>;
}

// =============================================================================
// Create AgeKey Types
// =============================================================================

/**
 * Verification methods supported by AgeKey.
 * Matches authorization-detail.schema.json#/$defs/methods.
 */
export type VerificationMethod =
  | "id_doc_scan"
  | "payment_card_network"
  | "facial_age_estimation"
  | "email_age_estimation"
  | "digital_credential"
  | "national_id_number";

/**
 * Allowed provenance values for Create AgeKey (authorization-detail.schema.json).
 * Required in each authorization_details entry; the SDK does not default it.
 */
export const AUTHORIZATION_PROVENANCE = [
  "/connect_id",
  "/stripe",
  "/inicis",
  "/singpass",
  "/privy",
  "/spruce_id",
  "/verify_my",
  "/privately",
  "/veratad/internal",
  "/veratad/trinsic",
  "/veratad/cra",
  "/veratad/roc",
] as const;

export type AuthorizationProvenance = (typeof AUTHORIZATION_PROVENANCE)[number];

/**
 * Age format: exact date of birth.
 */
export interface AgeDateOfBirth {
  date_of_birth: string; // ISO date: "YYYY-MM-DD"
}

/**
 * Age format: exact years old.
 */
export interface AgeYears {
  years: number;
}

/**
 * Age format: at least N years old.
 */
export interface AgeAtLeastYears {
  at_least_years: number;
}

/**
 * Age specification for Create AgeKey.
 */
export type AgeSpec = AgeDateOfBirth | AgeYears | AgeAtLeastYears;

/**
 * Options for creating an AgeKey via PAR (Pushed Authorization Request).
 */
export interface CreateAgeKeyOptions {
  /**
   * The verification method used.
   */
  method: VerificationMethod;

  /**
   * The verified age information.
   */
  age: AgeSpec;

  /**
   * When the verification occurred.
   */
  verifiedAt: Date;

  /**
   * A unique identifier for this verification (from your system).
   */
  verificationId: string;
  
  /**
   * Provenance (origin) of this verification. Required by authorization-detail.schema.json.
   * Use AUTHORIZATION_PROVENANCE for valid values (e.g. "/connect_id", "/veratad/roc").
   */
  provenance: AuthorizationProvenance | string;

  /**
   * Method-specific attributes (e.g., jurisdiction for national_id_number).
   */
  attributes?: Record<string, unknown>;

  /**
   * Enable upgrade flow: allow upgrading an existing AgeKey.
   */
  enableUpgrade?: boolean;
}

/**
 * Result from a PAR (Pushed Authorization Request).
 */
export interface PARResult {
  /**
   * The request_uri to use in the authorization URL.
   */
  requestUri: string;

  /**
   * How long the request_uri is valid (in seconds).
   */
  expiresIn: number;
}

/**
 * Result from handling a Create AgeKey callback.
 */
export interface CreateAgeKeyResult {
  /**
   * Whether the AgeKey was successfully created.
   */
  success: boolean;

  /**
   * Error code if the creation failed.
   */
  error?: string;

  /**
   * Human-readable error description.
   */
  errorDescription?: string;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error codes returned by the AgeKey API.
 */
export type AgeKeyErrorCode =
  | "invalid_request"
  | "unauthorized_client"
  | "access_denied"
  | "unsupported_response_type"
  | "invalid_scope"
  | "server_error"
  | "temporarily_unavailable"
  | "state_mismatch"
  | "nonce_mismatch"
  | "invalid_token"
  | "network_error";

// =============================================================================
// Internal Types
// =============================================================================

/**
 * Environment detection result.
 * @internal
 */
export interface Environment {
  isTest: boolean;
  baseUrl: string;
  useEndpoint: string;
  createEndpoint: string;
  parEndpoint: string;
}

/**
 * Claims format for Use AgeKey (request-claims.schema.json).
 * age_thresholds: required, 1-5 unique integers. Other fields optional.
 * @internal
 */
export interface UseAgeKeyClaims {
  /** Age thresholds to verify against (1-5 values, unique) */
  age_thresholds: number[];
  /** Optional list of allowed verification methods */
  allowed_methods?: VerificationMethod[];
  /** Optional minimum verification date */
  verified_after?: string;
  /** Optional method-specific overrides (may include age_thresholds per method) */
  overrides?: Record<string, MethodOverride | FacialAgeEstimationOverride>;
  /** Optional provenance filter */
  provenance?: {
    allowed?: string[];
    denied?: string[];
  };
}

/**
 * Method-specific override for age verification (request-claims.schema.json overrides).
 *
 * age_thresholds maps 1:1 to root age_thresholds by index: override[i] is the
 * minimum age (for this method) required to satisfy root threshold i.
 * Length must equal root age_thresholds length; order corresponds to sorted root age_thresholds.
 */
export interface MethodOverride {
  /** Minimum age threshold for this method */
  min_age?: number;
  /** Per-threshold age overrides (maps 1:1 to root age_thresholds, 1-5 items) */
  age_thresholds?: number[];
  /** Minimum verification date for this method */
  verified_after?: string;
  /** Method-specific attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Override for facial_age_estimation. Per request-claims.schema.json oneOf,
 * either min_age OR age_thresholds is required when this method is in overrides.
 */
export type FacialAgeEstimationOverride =
  | FacialOverrideWithMinAge
  | FacialOverrideWithAgeThresholds;

interface FacialOverrideBase {
  verified_after?: string;
  attributes?: { on_device?: boolean };
}

interface FacialOverrideWithMinAge extends FacialOverrideBase {
  min_age: number;
  age_thresholds?: number[];
}

interface FacialOverrideWithAgeThresholds extends FacialOverrideBase {
  min_age?: number;
  age_thresholds: number[];
}

/**
 * Method-specific overrides map (request-claims.schema.json).
 * All methods support optional age_thresholds array.
 * facial_age_estimation requires either min_age or age_thresholds (oneOf).
 */
export interface MethodOverridesMap {
  email_age_estimation?: MethodOverride;
  facial_age_estimation?: FacialAgeEstimationOverride;
  national_id_number?: MethodOverride;
  digital_credential?: MethodOverride;
  id_doc_scan?: MethodOverride;
  payment_card_network?: MethodOverride;
}

/**
 * Authorization details format for Create AgeKey (authorization-detail.schema.json).
 * provenance is required by the schema.
 * @internal
 */
export interface AuthorizationDetails {
  type: "age_verification";
  method: VerificationMethod;
  age: AgeSpec;
  verified_at: string;
  verification_id: string;
  provenance: string;
  attributes?: Record<string, unknown>;
}
