/**
 * CI guardrail (blueprint Phase 1 DoD): only EXPO_PUBLIC_* may be read from application code under mobile/src.
 * Allows process.env.EXPO_PUBLIC_* only.
 */
const fs = require("fs");
const path = require("path");

const srcRoot = path.join(__dirname, "..", "src");
const bad = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx)$/.test(name.name)) continue;
    const text = fs.readFileSync(full, "utf8");
    const re = /process\.env\.(?!EXPO_PUBLIC_)[A-Za-z0-9_]+/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      bad.push({ file: full, match: m[0] });
    }
  }
}

walk(srcRoot);

if (bad.length) {
  console.error("Forbidden process.env usage in mobile/src (only EXPO_PUBLIC_* allowed):\n");
  for (const b of bad) {
    console.error(`  ${path.relative(path.join(__dirname, ".."), b.file)}: ${b.match}`);
  }
  process.exit(1);
}

console.log("OK: no non-EXPO_PUBLIC process.env in mobile/src");
