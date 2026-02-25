export { AgeKey } from "./client";
export { UseAgeKeyClient } from "./use-agekey";
export { CreateAgeKeyClient } from "./create-agekey";

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
  VerificationMethod,
  AgeSpec,
  AgeDateOfBirth,
  AgeYears,
  AgeAtLeastYears,
  AuthorizationProvenance,
  MethodOverride,
  FacialAgeEstimationOverride,
  MethodOverridesMap,
  // Errors
  AgeKeyErrorCode,
  // Internal (for advanced use)
  Environment,
} from "./types";
export { AUTHORIZATION_PROVENANCE } from "./types";

export { generateToken, decodeJwtPayload, getEnvironment } from "./utils";

export { AGEKEY_ENDPOINTS, CREDENTIAL_PREFIXES } from "./constants";
