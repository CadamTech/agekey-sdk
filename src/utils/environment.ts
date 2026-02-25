import { AGEKEY_ENDPOINTS, CREDENTIAL_PREFIXES } from "../constants";
import type { Environment } from "../types";

export function validateCredentialEnvironments(clientId: string, clientSecret: string): void {
  const hasPrefix = clientSecret.startsWith(CREDENTIAL_PREFIXES.testSecret) ||
    clientSecret.startsWith(CREDENTIAL_PREFIXES.liveSecret);
  if (!hasPrefix) return;

  const clientTest = clientId.startsWith(CREDENTIAL_PREFIXES.testClientId);
  const secretTest = clientSecret.startsWith(CREDENTIAL_PREFIXES.testSecret);
  if (clientTest !== secretTest) {
    throw new Error(`Environment mismatch: clientId is ${clientTest ? "test" : "live"} but clientSecret is ${secretTest ? "test" : "live"}. Both must match.`);
  }
}

export function getEnvironment(clientId: string, apiBaseUrlOverride?: string): Environment {
  const isTest = clientId.startsWith(CREDENTIAL_PREFIXES.testClientId);
  const endpoints = isTest ? AGEKEY_ENDPOINTS.test : AGEKEY_ENDPOINTS.live;

  if (apiBaseUrlOverride) {
    return {
      isTest,
      baseUrl: apiBaseUrlOverride,
      useEndpoint: `${apiBaseUrlOverride}/v1/oidc/use`,
      createEndpoint: `${apiBaseUrlOverride}/v1/oidc/create`,
      parEndpoint: `${apiBaseUrlOverride}/v1/oidc/create/par`,
    };
  }
  return {
    isTest,
    baseUrl: endpoints.base,
    useEndpoint: endpoints.use,
    createEndpoint: endpoints.create,
    parEndpoint: endpoints.par,
  };
}
