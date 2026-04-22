/**
 * Ensures mobile locale JSON files share the same leaf keys as en.json.
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

if (exit === 0) {
  console.log("[i18n:check] Key parity OK (en ↔ ja ↔ es).");
}

process.exit(exit);
