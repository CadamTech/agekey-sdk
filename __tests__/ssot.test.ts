import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  clearSsotCache,
  fetchProvenanceConfig,
  fetchAuthorizationDetailSchema,
  verificationMethodsFromAuthorizationDetailSchema,
  digitalCredentialPlatformsFromAuthorizationDetailSchema,
  provenancePathsFromAuthorizationDetailSchema,
  activeProviderPathsFromProvenanceConfig,
  providerPathsForMethodFromProvenanceConfig,
  methodsForProviderPathFromProvenanceConfig,
  verificationMethodKeysFromProvenanceConfig,
} from "../src/ssot";

describe("SSOT schema loaders", () => {
  beforeEach(() => {
    clearSsotCache();
  });

  it("fetches and parses authorization-detail schema", async () => {
    const schemaJson = {
      $defs: {
        methods: { enum: ["id_doc_scan", "digital_credential"] },
        digital_credential_platforms: { enum: ["connect_id"] },
      },
      properties: {
        provenance: { enum: ["/a", "/b"] },
      },
    };

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(schemaJson),
    });

    const schema = await fetchAuthorizationDetailSchema({
      url: "https://example.test/schema.json",
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledWith("https://example.test/schema.json", {
      cache: "force-cache",
    });
    expect(verificationMethodsFromAuthorizationDetailSchema(schema)).toEqual([
      "id_doc_scan",
      "digital_credential",
    ]);
    expect(digitalCredentialPlatformsFromAuthorizationDetailSchema(schema)).toEqual([
      "connect_id",
    ]);
    expect(provenancePathsFromAuthorizationDetailSchema(schema)).toEqual(["/a", "/b"]);
  });

  it("fetches provenance config and derives provider helpers", async () => {
    const cfg = {
      version: 2,
      verification_methods: { id_doc_scan: { label: "ID" } },
      providers: {
        "/p1": {
          status: "active",
          methods: ["id_doc_scan"],
        },
        "/p2": {
          status: "inactive",
          methods: ["id_doc_scan"],
        },
        "/p3": {
          methods: ["digital_credential"],
        },
      },
    };

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(cfg),
    });

    const doc = await fetchProvenanceConfig({
      url: "https://example.test/provenance.json",
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(activeProviderPathsFromProvenanceConfig(doc).sort()).toEqual(
      ["/p1", "/p3"].sort()
    );
    expect(providerPathsForMethodFromProvenanceConfig(doc, "id_doc_scan")).toEqual([
      "/p1",
    ]);
    expect(methodsForProviderPathFromProvenanceConfig(doc, "/p3")).toEqual([
      "digital_credential",
    ]);
    expect(verificationMethodKeysFromProvenanceConfig(doc)).toEqual(["id_doc_scan"]);
  });

  it("reuses cache for the same URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ providers: {} }),
    });

    await fetchProvenanceConfig({
      url: "https://example.test/p.json",
      fetchImpl: fetchImpl as typeof fetch,
    });
    await fetchProvenanceConfig({
      url: "https://example.test/p.json",
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("throws when fetch is missing", async () => {
    vi.stubGlobal("fetch", undefined);
    try {
      await expect(fetchProvenanceConfig({ url: "https://x" })).rejects.toThrow(
        /fetch is not available/
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
