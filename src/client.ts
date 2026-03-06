import { getEnvironment, validateCredentialEnvironments } from "./utils";
import { UseAgeKeyClient } from "./use-agekey";
import { CreateAgeKeyClient } from "./create-agekey";
import { UpgradeDirectClient } from "./upgrade-direct";
import { InvalidRequestError } from "./errors";
import type { AgeKeyConfig, Environment } from "./types";

export class AgeKey {
  readonly useAgeKey: UseAgeKeyClient;
  readonly createAgeKey: CreateAgeKeyClient;
  readonly upgradeDirect: UpgradeDirectClient;
  readonly environment: Environment;
  private readonly config: AgeKeyConfig;

  constructor(config: AgeKeyConfig) {
    if (!config.clientId) {
      throw new InvalidRequestError("clientId is required");
    }
    if (!config.redirectUri) {
      throw new InvalidRequestError("redirectUri is required");
    }
    if (config.clientSecret) {
      validateCredentialEnvironments(config.clientId, config.clientSecret);
    }

    this.config = config;
    this.environment = getEnvironment(config.clientId, config.apiBaseUrl);

    // Initialize sub-clients
    this.useAgeKey = new UseAgeKeyClient(config, this.environment);
    this.createAgeKey = new CreateAgeKeyClient(config, this.environment);
    this.upgradeDirect = new UpgradeDirectClient(config, this.environment);
  }

  get isTestMode(): boolean {
    return this.environment.isTest;
  }

  get clientId(): string {
    return this.config.clientId;
  }

  get redirectUri(): string {
    return this.config.redirectUri;
  }
}
