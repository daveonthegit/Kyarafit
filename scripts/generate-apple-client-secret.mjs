#!/usr/bin/env node
/**
 * Generates an Apple OAuth client-secret JWT for Sign in with Apple (paste into Convex APPLE_CLIENT_SECRET).
 *
 * Requires: APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID (Service ID),
 *           APPLE_PRIVATE_KEY (.p8 contents, or path via APPLE_PRIVATE_KEY_PATH).
 *
 * Usage:
 *   node scripts/generate-apple-client-secret.mjs
 *
 * Dependencies: jose (installed at repo root).
 */

import { readFileSync } from "node:fs";
import { importPKCS8, SignJWT } from "jose";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env: ${name}`);
    process.exit(1);
  }
  return v;
}

function loadPrivateKey() {
  const path = process.env.APPLE_PRIVATE_KEY_PATH;
  const inline = process.env.APPLE_PRIVATE_KEY;
  let pem = inline;
  if (path) {
    pem = readFileSync(path, "utf8");
  }
  if (!pem) {
    console.error("Set APPLE_PRIVATE_KEY or APPLE_PRIVATE_KEY_PATH");
    process.exit(1);
  }
  return pem.includes("BEGIN PRIVATE KEY") ? pem.replace(/\\n/g, "\n") : pem;
}

async function main() {
  const teamId = requireEnv("APPLE_TEAM_ID");
  const keyId = requireEnv("APPLE_KEY_ID");
  const clientId = requireEnv("APPLE_CLIENT_ID");
  const pem = loadPrivateKey();
  const key = await importPKCS8(pem, "ES256");
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(now + 180 * 24 * 60 * 60)
    .sign(key);

  console.log(jwt);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
