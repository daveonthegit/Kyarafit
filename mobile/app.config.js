/* global __dirname */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

/** The operator supplies only the public certificate; the signer is never an app input. */
module.exports = ({ config }) => {
  const certificatePath = process.env.KYARAFIT_UPDATES_CERTIFICATE;
  const keyid = process.env.KYARAFIT_UPDATES_KEY_ID;
  const release = [process.env.EAS_BUILD_PROFILE, process.env.EXPO_PUBLIC_UPDATES_CHANNEL].some(
    (value) => value && value !== "development"
  );
  const updates = { ...config.updates, enabled: false };
  delete updates.codeSigningCertificate;
  delete updates.codeSigningMetadata;
  // Never weaken the native verifier, including when inherited config changes later.
  delete updates.codeSigningAllowUnsignedManifests;
  updates.disableAntiBrickingMeasures = false;

  if (!certificatePath && !keyid) {
    if (release) throw new Error("Release builds require OTA signing certificate and key id.");
    return { ...config, updates };
  }
  if (!certificatePath || !keyid || !/^[A-Za-z0-9._-]+$/.test(keyid)) {
    throw new Error("OTA signing requires a public certificate path and a valid key id.");
  }
  const resolved = path.resolve(__dirname, certificatePath);
  if (path.isAbsolute(certificatePath) || path.relative(__dirname, resolved).startsWith("..")) {
    throw new Error("OTA certificate must be a relative path inside the mobile project.");
  }
  let certificate;
  try {
    const pem = fs.readFileSync(resolved, "utf8").trim();
    // One public X.509 certificate only: reject keys and mixed PEM bundles before parsing.
    if (
      !/^-----BEGIN CERTIFICATE-----\s+[A-Za-z0-9+/=\s]+\s+-----END CERTIFICATE-----$/.test(pem)
    ) {
      throw new Error("Not a public certificate");
    }
    certificate = new crypto.X509Certificate(pem);
  } catch {
    throw new Error("OTA signing certificate is missing or is not a public X.509 certificate.");
  }
  const now = Date.now();
  if (
    certificate.publicKey.asymmetricKeyType !== "rsa" ||
    !(certificate.publicKey.asymmetricKeyDetails?.modulusLength >= 2048) ||
    !certificate.keyUsage?.includes("1.3.6.1.5.5.7.3.3") ||
    !(Date.parse(certificate.validFrom) <= now && now < Date.parse(certificate.validTo))
  ) {
    throw new Error("OTA certificate requires a currently valid RSA code-signing public key.");
  }
  return {
    ...config,
    updates: {
      ...updates,
      enabled: true,
      codeSigningCertificate: certificatePath,
      codeSigningMetadata: { keyid, alg: "rsa-v1_5-sha256" },
    },
  };
};
