// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const fs: typeof import("node:fs") = require("node:fs");
const crypto: typeof import("node:crypto") = require("node:crypto");
const configure = require("../../../app.config.js");
const base = require("../../../app.json").expo;
const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const { AndroidConfig, IOSConfig } = require("expo/config-plugins");

function signingEnvironment() {
  vi.stubEnv("KYARAFIT_UPDATES_CERTIFICATE", "certs/operator-public.pem");
  vi.stubEnv("KYARAFIT_UPDATES_KEY_ID", "operator-key-id");
}
function certificateModel(overrides: Record<string, unknown> = {}) {
  return {
    publicKey: { asymmetricKeyType: "rsa", asymmetricKeyDetails: { modulusLength: 2048 } },
    keyUsage: ["1.3.6.1.5.5.7.3.3"],
    validFrom: "Jan 1 2020 GMT",
    validTo: "Jan 1 2100 GMT",
    ...overrides,
  };
}
function mockPublicCertificate(model = certificateModel()) {
  // No keys/certificates are generated: this exercises policy on a parsed certificate model.
  const readFile = fs.readFileSync;
  const exists = fs.existsSync;
  const certPath = path.join(mobileRoot, "certs/operator-public.pem");
  vi.spyOn(fs, "readFileSync").mockImplementation((file, options) =>
    file === certPath
      ? "-----BEGIN CERTIFICATE-----\nYWJj\n-----END CERTIFICATE-----"
      : readFile(file, options)
  );
  vi.spyOn(fs, "existsSync").mockImplementation((file) => file === certPath || exists(file));
  vi.spyOn(crypto, "X509Certificate").mockImplementation(function () {
    return model;
  } as unknown as typeof crypto.X509Certificate);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("operator-configured OTA policy", () => {
  it("resolves unsigned local config through the real Expo consumer with OTA disabled", () => {
    const env = { ...process.env };
    for (const key of [
      "KYARAFIT_UPDATES_CERTIFICATE",
      "KYARAFIT_UPDATES_KEY_ID",
      "EAS_BUILD_PROFILE",
      "EXPO_PUBLIC_UPDATES_CHANNEL",
    ]) {
      delete env[key];
    }
    const expo = JSON.parse(
      execFileSync(process.execPath, [require.resolve("expo/bin/cli"), "config", "--json"], {
        cwd: mobileRoot,
        env,
        encoding: "utf8",
      })
    );
    expect(expo.updates.enabled).toBe(false);
    expect(expo.updates.codeSigningCertificate).toBeUndefined();
    expect(expo.updates.codeSigningAllowUnsignedManifests).toBeUndefined();
    expect(expo.plugins).toContainEqual([
      "expo-secure-store",
      { configureAndroidBackup: true, faceIDPermission: false },
    ]);
  });

  it.each(["preview", "production", "custom-release"])(
    "rejects %s builds without signing configuration",
    (profile) => {
      vi.stubEnv("KYARAFIT_UPDATES_CERTIFICATE", "");
      vi.stubEnv("KYARAFIT_UPDATES_KEY_ID", "");
      vi.stubEnv("EAS_BUILD_PROFILE", profile);
      expect(() => configure({ config: base })).toThrow("Release builds require OTA signing");
    }
  );

  it("also gates release channel exports and allows unsigned development with OTA off", () => {
    vi.stubEnv("KYARAFIT_UPDATES_CERTIFICATE", "");
    vi.stubEnv("KYARAFIT_UPDATES_KEY_ID", "");
    vi.stubEnv("EAS_BUILD_PROFILE", "development");
    vi.stubEnv("EXPO_PUBLIC_UPDATES_CHANNEL", "production");
    expect(() => configure({ config: base })).toThrow("Release builds require OTA signing");
    vi.stubEnv("EXPO_PUBLIC_UPDATES_CHANNEL", "development");
    expect(configure({ config: base }).updates.enabled).toBe(false);
  });

  it.each([
    ["certs/operator-public.pem", ""],
    ["", "operator-key-id"],
    ["certs/operator-public.pem", "invalid key id"],
    ["../outside.pem", "operator-key-id"],
    ["/outside.pem", "operator-key-id"],
  ])("rejects incomplete/invalid configuration (%s, %s)", (certificate, keyid) => {
    vi.stubEnv("KYARAFIT_UPDATES_CERTIFICATE", certificate);
    vi.stubEnv("KYARAFIT_UPDATES_KEY_ID", keyid);
    expect(() => configure({ config: base })).toThrow();
  });

  it("rejects an unavailable certificate without revealing file contents", () => {
    signingEnvironment();
    expect(() => configure({ config: base })).toThrow("not a public X.509 certificate");
  });

  it.each([
    "not a certificate",
    "-----BEGIN PRIVATE KEY-----\nredacted\n-----END PRIVATE KEY-----",
    "-----BEGIN CERTIFICATE-----\nYWJj\n-----END CERTIFICATE-----",
  ])("rejects malformed certificate or private material", (pem) => {
    signingEnvironment();
    vi.spyOn(fs, "readFileSync").mockReturnValue(pem);
    expect(() => configure({ config: base })).toThrow("not a public X.509 certificate");
  });

  it("emits native signing metadata only for a valid parsed public certificate", () => {
    signingEnvironment();
    mockPublicCertificate();
    const result = configure({
      config: {
        ...base,
        updates: {
          ...base.updates,
          codeSigningAllowUnsignedManifests: true,
          disableAntiBrickingMeasures: true,
        },
      },
    });
    expect(result.updates).toMatchObject({
      enabled: true,
      codeSigningCertificate: "certs/operator-public.pem",
      codeSigningMetadata: { keyid: "operator-key-id", alg: "rsa-v1_5-sha256" },
      disableAntiBrickingMeasures: false,
      url: base.updates.url,
    });
    expect(result.updates.codeSigningAllowUnsignedManifests).toBeUndefined();
    expect(crypto.X509Certificate).toHaveBeenCalledOnce();
  });

  it("passes signing configuration to the actual iOS and Android native config consumers", async () => {
    signingEnvironment();
    mockPublicCertificate();
    const config = configure({ config: base });
    const plist = await IOSConfig.Updates.setUpdatesConfigAsync(mobileRoot, config, {}, "55.0.21");
    const manifest = await AndroidConfig.Updates.setUpdatesConfigAsync(
      mobileRoot,
      config,
      { manifest: { application: [{ $: { "android:name": ".MainApplication" } }] } },
      "55.0.21"
    );
    expect(plist.EXUpdatesEnabled).toBe(true);
    expect(plist.EXUpdatesCodeSigningCertificate).toBe(
      "-----BEGIN CERTIFICATE-----\nYWJj\n-----END CERTIFICATE-----"
    );
    expect(plist.EXUpdatesCodeSigningMetadata).toEqual({
      keyid: "operator-key-id",
      alg: "rsa-v1_5-sha256",
    });
    expect(plist.EXUpdatesCodeSigningAllowUnsignedManifests).toBeUndefined();
    expect(plist.EXUpdatesDisableAntiBrickingMeasures).toBeUndefined();
    const metadata = Object.fromEntries(
      manifest.manifest.application[0]["meta-data"].map((entry: { $: Record<string, string> }) => [
        entry.$["android:name"],
        entry.$["android:value"],
      ])
    );
    expect(metadata["expo.modules.updates.ENABLED"]).toBe("true");
    expect(metadata["expo.modules.updates.CODE_SIGNING_CERTIFICATE"]).toBe(
      plist.EXUpdatesCodeSigningCertificate
    );
    expect(JSON.parse(metadata["expo.modules.updates.CODE_SIGNING_METADATA"])).toEqual(
      plist.EXUpdatesCodeSigningMetadata
    );
    expect(metadata["expo.modules.updates.CODE_SIGNING_ALLOW_UNSIGNED_MANIFESTS"]).toBeUndefined();
    expect(metadata["expo.modules.updates.DISABLE_ANTI_BRICKING_MEASURES"]).toBeUndefined();
  });

  it.each([
    { publicKey: { asymmetricKeyType: "ec", asymmetricKeyDetails: {} } },
    { publicKey: { asymmetricKeyType: "rsa", asymmetricKeyDetails: { modulusLength: 1024 } } },
    { keyUsage: undefined },
    { keyUsage: ["1.3.6.1.5.5.7.3.1"] },
    { validFrom: "Jan 1 2100 GMT" },
    { validTo: "Jan 1 2020 GMT" },
  ])("rejects incompatible certificate model %j", (overrides) => {
    signingEnvironment();
    mockPublicCertificate(certificateModel(overrides));
    expect(() => configure({ config: base })).toThrow("currently valid RSA code-signing");
  });
});
