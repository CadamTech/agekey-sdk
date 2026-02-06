/**
 * @agekey/sdk - Main Client
 *
 * The AgeKey client provides a unified interface for age verification.
 */

import { getEnvironment, validateCredentialEnvironments } from "./utils";
import { UseAgeKeyClient } from "./use-agekey";
import { CreateAgeKeyClient } from "./create-agekey";
import { InvalidRequestError } from "./errors";
import type { AgeKeyConfig, Environment } from "./types";

/**
 * AgeKey SDK client for age verification integration.
 *
 * @example
 * ```typescript
 * import { AgeKey } from '@agekey/sdk';
 *
 * const agekey = new AgeKey({
 *   clientId: 'ak_test_xxxx',
 *   clientSecret: 'sk_test_xxxx', // Server-side only
 *   redirectUri: 'https://myapp.com/callback',
 * });
 *
 * // Use AgeKey: Verify user's age
 * const { url, state, nonce } = agekey.useAgeKey.getAuthorizationUrl({
 *   ageThresholds: [13, 18, 21],
 * });
 *
 * // Create AgeKey: Store age verification (server-side only)
 * const { authUrl } = await agekey.createAgeKey.initiate({
 *   method: 'id_doc_scan',
 *   age: { date_of_birth: '2000-01-15' },
 *   verifiedAt: new Date(),
 *   verificationId: 'txn_123456',
 * });
 * ```
 */
export class AgeKey {
  /**
   * Use AgeKey namespace for age verification flows.
   * Use this to verify a user's age against thresholds.
   */
  readonly useAgeKey: UseAgeKeyClient;

  /**
   * Create AgeKey namespace for storing age verification signals.
   * Use this to create or upgrade an AgeKey (server-side only).
   */
  readonly createAgeKey: CreateAgeKeyClient;

  /**
   * The resolved environment configuration.
   */
  readonly environment: Environment;

  /**
   * The original configuration.
   */
  private readonly config: AgeKeyConfig;

  /**
   * Creates a new AgeKey client instance.
   *
   * @param config - Client configuration
   * @throws {InvalidRequestError} If configuration is invalid
   *
   * @example
   * ```typescript
   * // Client-side (Use AgeKey only)
   * const agekey = new AgeKey({
   *   clientId: 'ak_test_xxxx',
   *   redirectUri: 'https://myapp.com/callback',
   * });
   *
   * // Server-side (Use + Create AgeKey)
   * const agekey = new AgeKey({
   *   clientId: 'ak_test_xxxx',
   *   clientSecret: 'sk_test_xxxx',
   *   redirectUri: 'https://myapp.com/callback',
   * });
   * ```
   */
  constructor(config: AgeKeyConfig) {
    // Validate required fields
    if (!config.clientId) {
      throw new InvalidRequestError("clientId is required");
    }
    if (!config.redirectUri) {
      throw new InvalidRequestError("redirectUri is required");
    }

    // Validate credential environment match (if secret provided)
    if (config.clientSecret) {
      validateCredentialEnvironments(config.clientId, config.clientSecret);
    }

    this.config = config;
    this.environment = getEnvironment(config.clientId, config.apiBaseUrl);

    // Initialize sub-clients
    this.useAgeKey = new UseAgeKeyClient(config, this.environment);
    this.createAgeKey = new CreateAgeKeyClient(config, this.environment);
  }

  /**
   * Returns whether this client is configured for test environment.
   */
  get isTestMode(): boolean {
    return this.environment.isTest;
  }

  /**
   * Returns the client ID (App ID).
   */
  get clientId(): string {
    return this.config.clientId;
  }

  /**
   * Returns the configured redirect URI.
   */
  get redirectUri(): string {
    return this.config.redirectUri;
  }
}
