/**
 * Ensures mobile locale JSON files share the same leaf keys as en.json, and that the web message
 * catalogs (web/messages) share the same leaf keys as web/messages/en.json.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, "../../mobile/src/i18n/locales");

function leafKeys(obj, prefix = "") {
  /** @type {string[]} */
  let keys = [];
  for (const k of Object.keys(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      keys = keys.concat(leafKeys(v, p));
    } else {
      keys.push(p);
    }
  }
  return keys.sort();
}

function load(name) {
  const fp = path.join(localesDir, name);
  return JSON.parse(fs.readFileSync(fp, "utf8"));
}

const en = load("en.json");
const ja = load("ja.json");
const es = load("es.json");

const ke = new Set(leafKeys(en));
const kj = new Set(leafKeys(ja));
const ks = new Set(leafKeys(es));

let exit = 0;

for (const k of ke) {
  if (!kj.has(k)) {
    console.error("[i18n:check] Missing in ja.json:", k);
    exit = 1;
  }
  if (!ks.has(k)) {
    console.error("[i18n:check] Missing in es.json:", k);
    exit = 1;
  }
}

for (const k of kj) {
  if (!ke.has(k)) {
    console.error("[i18n:check] Extra key in ja.json:", k);
    exit = 1;
  }
}

for (const k of ks) {
  if (!ke.has(k)) {
    console.error("[i18n:check] Extra key in es.json:", k);
    exit = 1;
  }
}

const webDir = path.join(__dirname, "../../web/messages");
const loadWeb = (name) => JSON.parse(fs.readFileSync(path.join(webDir, name), "utf8"));
const webEn = new Set(leafKeys(loadWeb("en.json")));
for (const file of fs.readdirSync(webDir).filter((f) => f.endsWith(".json") && f !== "en.json")) {
  const other = new Set(leafKeys(loadWeb(file)));
  for (const k of webEn) {
    if (!other.has(k)) {
      console.error(`[i18n:check] Missing in web/messages/${file}:`, k);
      exit = 1;
    }
  }
  for (const k of other) {
    if (!webEn.has(k)) {
      console.error(`[i18n:check] Extra key in web/messages/${file}:`, k);
      exit = 1;
    }
  }
}

if (exit === 0) {
  console.log("[i18n:check] Key parity OK (mobile en ↔ ja ↔ es; web en ↔ es).");
}

process.exit(exit);
