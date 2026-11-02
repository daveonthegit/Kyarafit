// @vitest-environment node
import { describe, expect, it } from "vitest";
import { androidAssetLinks, appleAppSiteAssociation, associationResponse } from "./appLinks";

const FINGERPRINT = Array.from({ length: 32 }, () => "AB").join(":");

describe("claimed app links", () => {
  it("claims only /native/* for the configured iOS app", () => {
    const aasa = appleAppSiteAssociation({ APPLE_TEAM_ID: "ABCDE12345" });
    expect(aasa).toEqual({
      applinks: {
        details: [
          { appIDs: ["ABCDE12345.com.kyarafit.mobile"], components: [{ "/": "/native/*" }] },
        ],
      },
      webcredentials: { apps: ["ABCDE12345.com.kyarafit.mobile"] },
    });
  });

  it("publishes Android links only for valid signing fingerprints", () => {
    expect(androidAssetLinks({})).toBeNull();
    expect(androidAssetLinks({ ANDROID_CERT_SHA256_FINGERPRINTS: "not-a-fingerprint" })).toBeNull();
    expect(
      androidAssetLinks({ ANDROID_CERT_SHA256_FINGERPRINTS: ` ${FINGERPRINT.toLowerCase()} ` })
    ).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.kyarafit.mobile",
          sha256_cert_fingerprints: [FINGERPRINT],
        },
      },
    ]);
  });

  it("serves nothing for an unconfigured or invalid app identity", async () => {
    expect(appleAppSiteAssociation({})).toBeNull();
    expect(appleAppSiteAssociation({ APPLE_TEAM_ID: "TEAMID" })).toBeNull();
    expect(associationResponse(null).status).toBe(404);
    const served = associationResponse({ ok: true });
    expect(served.headers.get("content-type")).toContain("application/json");
  });
});
