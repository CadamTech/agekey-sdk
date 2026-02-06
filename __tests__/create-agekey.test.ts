/**
 * @agekey/sdk - Create AgeKey Tests
 */

import { describe, it, expect, vi } from "vitest";
import { AgeKey, InvalidRequestError } from "../src";

describe("Create AgeKey", () => {
  const createClient = () =>
    new AgeKey({
      clientId: "ak_test_123456",
      clientSecret: "sk_test_789012",
      redirectUri: "https://example.com/callback",
    });

  describe("pushAuthorizationRequest", () => {
    it("throws InvalidRequestError when client secret is missing", async () => {
      const agekey = new AgeKey({
        clientId: "ak_test_123456",
        redirectUri: "https://example.com/callback",
        // No clientSecret
      });

      await expect(
        agekey.createAgeKey.pushAuthorizationRequest({
          method: "id_doc_scan",
          age: { date_of_birth: "2000-01-15" },
          verifiedAt: new Date(),
          verificationId: "txn_123",
        })
      ).rejects.toThrow(InvalidRequestError);
    });

    it("makes PAR request with correct parameters", async () => {
      const agekey = createClient();

      // Mock fetch
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            request_uri: "urn:ietf:params:oauth:request_uri:abc123",
            expires_in: 90,
          }),
      });
      global.fetch = mockFetch;

      const result = await agekey.createAgeKey.pushAuthorizationRequest({
        method: "id_doc_scan",
        age: { date_of_birth: "2000-01-15" },
        verifiedAt: new Date("2024-01-15T12:00:00Z"),
        verificationId: "txn_123",
      });

      expect(result.requestUri).toBe(
        "urn:ietf:params:oauth:request_uri:abc123"
      );
      expect(result.expiresIn).toBe(90);

      // Verify fetch was called correctly
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.test.agekey.org/v1/oidc/create/par");
      expect(options.method).toBe("POST");
      expect(options.headers["Content-Type"]).toBe(
        "application/x-www-form-urlencoded"
      );

      // Verify form data
      const body = new URLSearchParams(options.body);
      expect(body.get("client_id")).toBe("ak_test_123456");
      expect(body.get("client_secret")).toBe("sk_test_789012");
      expect(body.get("redirect_uri")).toBe("https://example.com/callback");
      expect(body.get("response_type")).toBe("none");

      // Verify authorization_details
      const authDetails = JSON.parse(
        body.get("authorization_details") || "[]"
      );
      expect(authDetails[0].type).toBe("age_verification");
      expect(authDetails[0].method).toBe("id_doc_scan");
      expect(authDetails[0].age.date_of_birth).toBe("2000-01-15");
    });
  });

  describe("getAuthorizationUrl", () => {
    it("builds authorization URL from request_uri", () => {
      const agekey = createClient();
      const requestUri = "urn:ietf:params:oauth:request_uri:abc123";

      const url = agekey.createAgeKey.getAuthorizationUrl(requestUri);

      expect(url).toContain("https://api.test.agekey.org/v1/oidc/create");
      expect(url).toContain("client_id=ak_test_123456");
      expect(url).toContain("response_type=none");
      expect(url).toContain(
        `request_uri=${encodeURIComponent(requestUri)}`
      );
    });

    it("includes upgrade scope when enabled", () => {
      const agekey = createClient();
      const requestUri = "urn:ietf:params:oauth:request_uri:abc123";

      const url = agekey.createAgeKey.getAuthorizationUrl(requestUri, {
        enableUpgrade: true,
      });

      expect(url).toContain("scope=openid+agekey.upgrade");
      expect(url).toContain("can_upgrade=true");
    });
  });

  describe("handleCallback", () => {
    it("returns success for callback without error", () => {
      const agekey = createClient();
      const callbackUrl = "https://example.com/callback?state=xyz";

      const result = agekey.createAgeKey.handleCallback(callbackUrl);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("returns error for callback with error", () => {
      const agekey = createClient();
      const callbackUrl =
        "https://example.com/callback?error=access_denied&error_description=User+cancelled";

      const result = agekey.createAgeKey.handleCallback(callbackUrl);

      expect(result.success).toBe(false);
      expect(result.error).toBe("access_denied");
      expect(result.errorDescription).toBe("User cancelled");
    });
  });

  describe("initiate", () => {
    it("combines PAR and authorization URL", async () => {
      const agekey = createClient();

      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            request_uri: "urn:ietf:params:oauth:request_uri:abc123",
            expires_in: 90,
          }),
      });

      const result = await agekey.createAgeKey.initiate({
        method: "id_doc_scan",
        age: { date_of_birth: "2000-01-15" },
        verifiedAt: new Date(),
        verificationId: "txn_123",
      });

      expect(result.requestUri).toBe(
        "urn:ietf:params:oauth:request_uri:abc123"
      );
      expect(result.expiresIn).toBe(90);
      expect(result.authUrl).toContain(
        "https://api.test.agekey.org/v1/oidc/create"
      );
      expect(result.authUrl).toContain(
        encodeURIComponent("urn:ietf:params:oauth:request_uri:abc123")
      );
    });
  });
});
