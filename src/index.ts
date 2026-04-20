export { AgeKey } from "./client";
export { UseAgeKeyClient } from "./use-agekey";
export { CreateAgeKeyClient } from "./create-agekey";
export { UpgradeDirectClient } from "./upgrade-direct";

export {
  AgeKeyError,
  StateMismatchError,
  NonceMismatchError,
  AccessDeniedError,
  InvalidTokenError,
  InvalidRequestError,
  UnauthorizedClientError,
  ServerError,
  NetworkError,
  mapOidcError,
} from "./errors";

export type {
  // Configuration
  AgeKeyConfig,
  // Use AgeKey
  UseAgeKeyOptions,
  AuthorizationUrlResult,
  CallbackValidationParams,
  UseAgeKeyResult,
  // Create AgeKey
  CreateAgeKeyOptions,
  PARResult,
  CreateAgeKeyResult,
  // Upgrade Direct
  UpgradeDirectOptions,
  ExchangeTokenResult,
  UpgradeDirectResult,
  VerificationMethod,
  AgeSpec,
  AgeDateOfBirth,
  AgeYears,
  AgeAtLeastYears,
  MethodOverride,
  FacialAgeEstimationOverride,
  MethodOverridesMap,
  // Errors
  AgeKeyErrorCode,
  // Internal (for advanced use)
  Environment,
} from "./types";

export { generateToken, decodeJwtPayload, getEnvironment } from "./utils";

export {
  DEFAULT_PROVENANCE_CONFIG_URL,
  DEFAULT_AUTHORIZATION_DETAIL_SCHEMA_URL,
  clearSsotCache,
  fetchProvenanceConfig,
  fetchAuthorizationDetailSchema,
  verificationMethodsFromAuthorizationDetailSchema,
  digitalCredentialPlatformsFromAuthorizationDetailSchema,
  provenancePathsFromAuthorizationDetailSchema,
  activeProviderPathsFromProvenanceConfig,
  providerEntryFromProvenanceConfig,
  providerPathsForMethodFromProvenanceConfig,
  methodsForProviderPathFromProvenanceConfig,
  verificationMethodKeysFromProvenanceConfig,
} from "./ssot";

export type {
  FetchLike,
  SsotFetchOptions,
  AuthorizationDetailSchema,
  ProvenanceProviderEntry,
  ProvenanceConfigDocument,
} from "./ssot";

export { AGEKEY_ENDPOINTS, CREDENTIAL_PREFIXES } from "./constants";
