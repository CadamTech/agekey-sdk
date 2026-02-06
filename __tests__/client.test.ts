/**
 * @agekey/sdk - Client Tests
 */

import { describe, it, expect } from "vitest";
import { AgeKey, InvalidRequestError } from "../src";

describe("AgeKey Client", () => {
  describe("constructor", () => {
    it("creates client with valid test credentials", () => {
      const agekey = new AgeKey({
        clientId: "ak_test_123456",
        redirectUri: "https://example.com/callback",
      });

      expect(agekey.clientId).toBe("ak_test_123456");
      expect(agekey.redirectUri).toBe("https://example.com/callback");
      expect(agekey.isTestMode).toBe(true);
    });

    it("creates client with valid live credentials", () => {
      const agekey = new AgeKey({
        clientId: "ak_live_123456",
        redirectUri: "https://example.com/callback",
      });

      expect(agekey.isTestMode).toBe(false);
    });

    it("creates client with client secret", () => {
      const agekey = new AgeKey({
        clientId: "ak_test_123456",
        clientSecret: "sk_test_789012",
        redirectUri: "https://example.com/callback",
      });

      expect(agekey.clientId).toBe("ak_test_123456");
    });

    it("throws on missing clientId", () => {
      expect(() => {
        new AgeKey({
          clientId: "",
          redirectUri: "https://example.com/callback",
        });
      }).toThrow(InvalidRequestError);
    });

    it("throws on missing redirectUri", () => {
      expect(() => {
        new AgeKey({
          clientId: "ak_test_123456",
          redirectUri: "",
        });
      }).toThrow(InvalidRequestError);
    });

    it("throws on environment mismatch (test clientId + live secret)", () => {
      expect(() => {
        new AgeKey({
          clientId: "ak_test_123456",
          clientSecret: "sk_live_789012",
          redirectUri: "https://example.com/callback",
        });
      }).toThrow("Environment mismatch");
    });

    it("throws on environment mismatch (live clientId + test secret)", () => {
      expect(() => {
        new AgeKey({
          clientId: "ak_live_123456",
          clientSecret: "sk_test_789012",
          redirectUri: "https://example.com/callback",
        });
      }).toThrow("Environment mismatch");
    });
  });

  describe("environment detection", () => {
    it("uses test endpoints for test credentials", () => {
      const agekey = new AgeKey({
        clientId: "ak_test_123456",
        redirectUri: "https://example.com/callback",
      });

      expect(agekey.environment.baseUrl).toBe("https://api.test.agekey.org");
      expect(agekey.environment.useEndpoint).toBe(
        "https://api.test.agekey.org/v1/oidc/use"
      );
    });

    it("uses live endpoints for live credentials", () => {
      const agekey = new AgeKey({
        clientId: "ak_live_123456",
        redirectUri: "https://example.com/callback",
      });

      expect(agekey.environment.baseUrl).toBe("https://api.agekey.org");
      expect(agekey.environment.useEndpoint).toBe(
        "https://api.agekey.org/v1/oidc/use"
      );
    });

    it("respects apiBaseUrl override", () => {
      const agekey = new AgeKey({
        clientId: "ak_test_123456",
        redirectUri: "https://example.com/callback",
        apiBaseUrl: "https://custom.agekey.local",
      });

      expect(agekey.environment.baseUrl).toBe("https://custom.agekey.local");
      expect(agekey.environment.useEndpoint).toBe(
        "https://custom.agekey.local/v1/oidc/use"
      );
    });
  });

  describe("sub-clients", () => {
    it("provides useAgeKey namespace", () => {
      const agekey = new AgeKey({
        clientId: "ak_test_123456",
        redirectUri: "https://example.com/callback",
      });

      expect(agekey.useAgeKey).toBeDefined();
      expect(typeof agekey.useAgeKey.getAuthorizationUrl).toBe("function");
      expect(typeof agekey.useAgeKey.handleCallback).toBe("function");
    });

    it("provides createAgeKey namespace", () => {
      const agekey = new AgeKey({
        clientId: "ak_test_123456",
        clientSecret: "sk_test_789012",
        redirectUri: "https://example.com/callback",
      });

      expect(agekey.createAgeKey).toBeDefined();
      expect(typeof agekey.createAgeKey.pushAuthorizationRequest).toBe(
        "function"
      );
      expect(typeof agekey.createAgeKey.getAuthorizationUrl).toBe("function");
    });
  });
});
