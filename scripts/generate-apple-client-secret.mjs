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
 * Loads `.env` then `.env.local` from the repo root via `dotenv` (supports multiline quoted values).
 * Variables already set in the shell are not overwritten.
 *
 * Dependencies: jose, dotenv (repo root).
 */

import { createPrivateKey } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { SignJWT } from "jose";

function loadEnvFiles() {
  const cwd = process.cwd();
  dotenv.config({ path: resolve(cwd, ".env") });
  dotenv.config({ path: resolve(cwd, ".env.local"), override: true });
}

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing env: ${name}`);
    console.error(
      "Set it in the shell, or add it to .env / .env.local in the repo root (same directory as package.json)."
    );
    process.exit(1);
  }
  return v;
}

function loadPrivateKeyPem() {
  const rawPath = process.env.APPLE_PRIVATE_KEY_PATH?.trim();
  const inline = process.env.APPLE_PRIVATE_KEY;
  let pem = inline;
  if (rawPath) {
    const keyPath = resolve(process.cwd(), rawPath);
    if (!existsSync(keyPath)) {
      console.error(`APPLE_PRIVATE_KEY_PATH not found: ${keyPath}`);
      process.exit(1);
    }
    if (lstatSync(keyPath).isDirectory()) {
      console.error(
        `APPLE_PRIVATE_KEY_PATH is a directory (${keyPath}), not a file. Point it at the downloaded key file, e.g. ...\\AuthKey_ABC123XYZ.p8`
      );
      process.exit(1);
    }
    pem = readFileSync(keyPath, "utf8");
  }
  if (!pem) {
    console.error("Set APPLE_PRIVATE_KEY or APPLE_PRIVATE_KEY_PATH");
    process.exit(1);
  }
  pem = pem.trim().replace(/\r\n/g, "\n");
  // Inline .env often stores one line with literal \n
  if (pem.includes("BEGIN") && pem.includes("\\n")) {
    pem = pem.replace(/\\n/g, "\n");
  }
  if (!pem.includes("BEGIN PRIVATE KEY") && !pem.includes("BEGIN EC PRIVATE KEY")) {
    console.error(
      "Private key must be PEM with -----BEGIN PRIVATE KEY----- or -----BEGIN EC PRIVATE KEY----- (Apple .p8)."
    );
    process.exit(1);
  }
  const hasEnd = pem.includes("END PRIVATE KEY") || pem.includes("END EC PRIVATE KEY");
  if (!hasEnd || pem.length < 80) {
    console.error(
      "Private key PEM looks truncated (missing END line or body). If APPLE_PRIVATE_KEY is in .env, use multiline double-quoted value, or set APPLE_PRIVATE_KEY_PATH to the downloaded AuthKey_XXXXX.p8 file."
    );
    process.exit(1);
  }
  return pem;
}

async function main() {
  loadEnvFiles();
  const teamId = requireEnv("APPLE_TEAM_ID");
  const keyId = requireEnv("APPLE_KEY_ID");
  const clientId = requireEnv("APPLE_CLIENT_ID");
  const pem = loadPrivateKeyPem();
  // Apple .p8 may be PKCS#8 (BEGIN PRIVATE KEY) or SEC1 EC (BEGIN EC PRIVATE KEY).
  let key;
  try {
    key = createPrivateKey({ key: pem, format: "pem" });
  } catch (e) {
    console.error(String(e?.message ?? e));
    console.error(
      "\nCould not parse the private key. Set APPLE_PRIVATE_KEY_PATH to the absolute path of the AuthKey_XXXXX.p8 file from Apple (Keys). Avoid pasting PEM into .env unless it is a complete quoted multiline block."
    );
    process.exit(1);
  }
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
