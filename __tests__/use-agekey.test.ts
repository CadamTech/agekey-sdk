/**
 * @agekey/sdk - Use AgeKey Tests
 */

import { describe, it, expect } from "vitest";
import {
  AgeKey,
  StateMismatchError,
  NonceMismatchError,
  AccessDeniedError,
  InvalidTokenError,
} from "../src";

describe("Use AgeKey", () => {
  const createClient = () =>
    new AgeKey({
      clientId: "ak_test_123456",
      redirectUri: "https://example.com/callback",
    });

  describe("getAuthorizationUrl", () => {
    it("builds URL with age thresholds", () => {
      const agekey = createClient();
      const { url, state, nonce } = agekey.useAgeKey.getAuthorizationUrl({
        ageThresholds: [13, 18, 21],
      });

      expect(url).toContain("https://api-test.agekey.org/v1/oidc/use");
      expect(url).toContain("client_id=ak_test_123456");
      expect(url).toContain("redirect_uri=https%3A%2F%2Fexample.com%2Fcallback");
      expect(url).toContain("response_type=id_token");
      expect(url).toContain("scope=openid");
      expect(url).toContain(`state=${state}`);
      expect(url).toContain(`nonce=${nonce}`);

      // Claims should contain age thresholds (flat format)
      const urlObj = new URL(url);
      const claims = JSON.parse(urlObj.searchParams.get("claims") || "{}");
      expect(claims.age_thresholds).toEqual([13, 18, 21]);
    });

    it("requests response_mode=fragment", () => {
      const agekey = createClient();
      const { url } = agekey.useAgeKey.getAuthorizationUrl({
        ageThresholds: [18],
      });

      expect(url).toContain("response_mode=fragment");
    });

    it("requests response_mode=fragment for the upgrade flow", () => {
      const agekey = createClient();
      const { url } = agekey.useAgeKey.getAuthorizationUrl({
        ageThresholds: [18],
        enableUpgrade: true,
      });

      expect(url).toContain("response_mode=fragment");
    });

    it("generates unique state and nonce", () => {
      const agekey = createClient();
      const result1 = agekey.useAgeKey.getAuthorizationUrl({ ageThresholds: [18] });
      const result2 = agekey.useAgeKey.getAuthorizationUrl({ ageThresholds: [18] });

      expect(result1.state).not.toBe(result2.state);
      expect(result1.nonce).not.toBe(result2.nonce);
    });

    it("includes allowed_methods when specified", () => {
      const agekey = createClient();
      const { url } = agekey.useAgeKey.getAuthorizationUrl({
        ageThresholds: [18],
        allowedMethods: ["id_doc_scan", "payment_card_network"],
      });

      const urlObj = new URL(url);
      const claims = JSON.parse(urlObj.searchParams.get("claims") || "{}");
      // Flat format: claims.allowed_methods is an array directly
      expect(claims.allowed_methods).toEqual([
        "id_doc_scan",
        "payment_card_network",
      ]);
    });

    it("includes verified_after when specified", () => {
      const agekey = createClient();
      const verifiedAfter = new Date("2024-01-01");
      const { url } = agekey.useAgeKey.getAuthorizationUrl({
        ageThresholds: [18],
        verifiedAfter,
      });

      const urlObj = new URL(url);
      const claims = JSON.parse(urlObj.searchParams.get("claims") || "{}");
      // Flat format: verified_after is a date string (YYYY-MM-DD)
      expect(claims.verified_after).toBe("2024-01-01");
    });

    it("sets upgrade scope and response_type when enableUpgrade is true", () => {
      const agekey = createClient();
      const { url } = agekey.useAgeKey.getAuthorizationUrl({
        ageThresholds: [18],
        enableUpgrade: true,
      });

      expect(url).toContain("scope=openid+agekey.upgrade");
      expect(url).toContain("response_type=id_token+code");
    });

    it("sets can_create flag when enableCreate is true", () => {
      const agekey = createClient();
      const { url } = agekey.useAgeKey.getAuthorizationUrl({
        ageThresholds: [18],
        enableCreate: true,
      });

      expect(url).toContain("can_create=true");
      expect(url).toContain("scope=openid&");
    });

    it("sets can_create=false when enableCreate is false", () => {
      const agekey = createClient();
      const { url } = agekey.useAgeKey.getAuthorizationUrl({
        ageThresholds: [18],
        enableCreate: false,
      });

      expect(url).toContain("can_create=false");
    });

    it("omits can_create when enableCreate is not provided", () => {
      const agekey = createClient();
      const { url } = agekey.useAgeKey.getAuthorizationUrl({
        ageThresholds: [18],
      });

      expect(url).not.toContain("can_create");
    });

    it("includes overrides when specified", () => {
      const agekey = createClient();
      const { url } = agekey.useAgeKey.getAuthorizationUrl({
        ageThresholds: [18],
        overrides: {
          facial_age_estimation: {
            min_age: 21,
            attributes: { on_device: true },
          },
        },
      });

      const urlObj = new URL(url);
      const claims = JSON.parse(urlObj.searchParams.get("claims") || "{}");
      expect(claims.overrides).toBeDefined();
      expect(claims.overrides.facial_age_estimation.min_age).toBe(21);
    });

    it("nests iso_27566_1.required when requested", () => {
      const agekey = createClient();
      const { url } = agekey.useAgeKey.getAuthorizationUrl({
        ageThresholds: [18],
        iso27566: { required: true },
      });

      const urlObj = new URL(url);
      const claims = JSON.parse(urlObj.searchParams.get("claims") || "{}");
      expect(claims.iso_27566_1).toEqual({ required: true });
    });

    it("omits iso_27566_1 when not requested", () => {
      const agekey = createClient();
      const { url } = agekey.useAgeKey.getAuthorizationUrl({ ageThresholds: [18] });

      const urlObj = new URL(url);
      const claims = JSON.parse(urlObj.searchParams.get("claims") || "{}");
      expect(claims.iso_27566_1).toBeUndefined();
    });

    it("maps snake_case levelOfEffectiveness to the ISO wire label inside iso_27566_1", () => {
      const agekey = createClient();
      const { url } = agekey.useAgeKey.getAuthorizationUrl({
        ageThresholds: [18],
        iso27566: { levelOfEffectiveness: "highly_effective" },
      });

      const urlObj = new URL(url);
      const claims = JSON.parse(urlObj.searchParams.get("claims") || "{}");
      expect(claims.iso_27566_1).toEqual({ level_of_effectiveness: "Highly Effective" });
    });

    it("maps the per-method iso_27566_1 override to wire labels", () => {
      const agekey = createClient();
      const { url } = agekey.useAgeKey.getAuthorizationUrl({
        ageThresholds: [18],
        iso27566: { required: true, levelOfEffectiveness: "effective" },
        overrides: {
          facial_age_estimation: {
            min_age: 21,
            iso_27566_1: { required: true, level_of_effectiveness: "strict" },
          },
        },
      });

      const urlObj = new URL(url);
      const claims = JSON.parse(urlObj.searchParams.get("claims") || "{}");
      expect(claims.iso_27566_1).toEqual({ required: true, level_of_effectiveness: "Effective" });
      expect(claims.overrides.facial_age_estimation.iso_27566_1).toEqual({
        required: true,
        level_of_effectiveness: "Strict",
      });
    });
  });

  describe("handleCallback", () => {
    // Helper to create a mock JWT
    const createMockJwt = (payload: Record<string, unknown>) => {
      const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
      const body = btoa(JSON.stringify(payload));
      const signature = "mock_signature";
      return `${header}.${body}.${signature}`;
    };

    it("extracts age thresholds from valid callback", () => {
      const agekey = createClient();
      const state = "test_state_123";
      const nonce = "test_nonce_456";

      const idToken = createMockJwt({
        sub: "user_123",
        nonce,
        exp: Math.floor(Date.now() / 1000) + 3600,
        age_thresholds: { "13": true, "18": true, "21": false },
      });

      const callbackUrl = `https://example.com/callback?id_token=${idToken}&state=${state}`;

      const result = agekey.useAgeKey.handleCallback(callbackUrl, {
        state,
        nonce,
      });

      expect(result.ageThresholds).toEqual({
        "13": true,
        "18": true,
        "21": false,
      });
      expect(result.subject).toBe("user_123");
    });

    it("extracts age thresholds from fragment-encoded callback", () => {
      const agekey = createClient();
      const state = "test_state_123";
      const nonce = "test_nonce_456";

      const idToken = createMockJwt({
        sub: "user_123",
        nonce,
        exp: Math.floor(Date.now() / 1000) + 3600,
        age_thresholds: { "13": true, "18": false },
      });

      const callbackUrl = `https://example.com/callback#id_token=${idToken}&state=${state}&code=abc123`;

      const result = agekey.useAgeKey.handleCallback(callbackUrl, {
        state,
        nonce,
      });

      expect(result.ageThresholds).toEqual({ "13": true, "18": false });
      expect(result.subject).toBe("user_123");
      expect(result.code).toBe("abc123");
    });

    it("throws StateMismatchError on state mismatch", () => {
      const agekey = createClient();
      const nonce = "test_nonce_456";

      const idToken = createMockJwt({
        nonce,
        exp: Math.floor(Date.now() / 1000) + 3600,
        age_thresholds: { "18": true },
      });

      const callbackUrl = `https://example.com/callback?id_token=${idToken}&state=wrong_state`;

      expect(() => {
        agekey.useAgeKey.handleCallback(callbackUrl, {
          state: "expected_state",
          nonce,
        });
      }).toThrow(StateMismatchError);
    });

    it("throws NonceMismatchError on nonce mismatch", () => {
      const agekey = createClient();
      const state = "test_state_123";

      const idToken = createMockJwt({
        nonce: "wrong_nonce",
        exp: Math.floor(Date.now() / 1000) + 3600,
        age_thresholds: { "18": true },
      });

      const callbackUrl = `https://example.com/callback?id_token=${idToken}&state=${state}`;

      expect(() => {
        agekey.useAgeKey.handleCallback(callbackUrl, {
          state,
          nonce: "expected_nonce",
        });
      }).toThrow(NonceMismatchError);
    });

    it("throws AccessDeniedError on access_denied error", () => {
      const agekey = createClient();

      const callbackUrl =
        "https://example.com/callback?error=access_denied&error_description=User+cancelled";

      expect(() => {
        agekey.useAgeKey.handleCallback(callbackUrl, {
          state: "any",
          nonce: "any",
        });
      }).toThrow(AccessDeniedError);
    });

    it("throws InvalidTokenError when no id_token", () => {
      const agekey = createClient();
      const state = "test_state_123";

      const callbackUrl = `https://example.com/callback?state=${state}`;

      expect(() => {
        agekey.useAgeKey.handleCallback(callbackUrl, {
          state,
          nonce: "any",
        });
      }).toThrow(InvalidTokenError);
    });

    it("throws InvalidTokenError on expired token", () => {
      const agekey = createClient();
      const state = "test_state_123";
      const nonce = "test_nonce_456";

      const idToken = createMockJwt({
        nonce,
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired
        age_thresholds: { "18": true },
      });

      const callbackUrl = `https://example.com/callback?id_token=${idToken}&state=${state}`;

      expect(() => {
        agekey.useAgeKey.handleCallback(callbackUrl, { state, nonce });
      }).toThrow(InvalidTokenError);
    });
  });

  describe("parseCallback", () => {
    it("parses callback parameters without validation", () => {
      const agekey = createClient();
      const callbackUrl =
        "https://example.com/callback?id_token=abc&state=xyz&error=test&error_description=desc";

      const result = agekey.useAgeKey.parseCallback(callbackUrl);

      expect(result.idToken).toBe("abc");
      expect(result.state).toBe("xyz");
      expect(result.error).toBe("test");
      expect(result.errorDescription).toBe("desc");
    });

    it("parses fragment-encoded parameters", () => {
      const agekey = createClient();
      const callbackUrl =
        "https://example.com/callback#id_token=abc&state=xyz&code=c1";

      const result = agekey.useAgeKey.parseCallback(callbackUrl);

      expect(result.idToken).toBe("abc");
      expect(result.state).toBe("xyz");
      expect(result.code).toBe("c1");
    });
  });
});
