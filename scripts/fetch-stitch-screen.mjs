/**
 * Fetches Stitch screen HTML + screenshot for design reference.
 * Requires STITCH_API_KEY in the environment.
 *
 * Usage: node scripts/fetch-stitch-screen.mjs
 *
 * Writes to docs/stitch-refs/build-detail/reference.html and reference.png
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "docs", "stitch-refs", "build-detail");

const PROJECT_ID = "4723828042438665807";
const SCREEN_ID = "7d30c8b4d9124e4fa8f9d07943592d5c";

async function main() {
  if (!process.env.STITCH_API_KEY) {
    console.error("Missing STITCH_API_KEY. Set it and re-run, or add reference files manually.");
    process.exit(1);
  }

  const { stitch } = await import("@google/stitch-sdk");
  const project = stitch.project(PROJECT_ID);
  const screen = await project.getScreen(SCREEN_ID);
  const htmlUrl = await screen.getHtml();
  const imageUrl = await screen.getImage();

  await mkdir(OUT_DIR, { recursive: true });

  const [htmlRes, imgRes] = await Promise.all([fetch(htmlUrl), fetch(imageUrl)]);
  if (!htmlRes.ok) throw new Error(`HTML fetch failed: ${htmlRes.status}`);
  if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);

  const html = await htmlRes.text();
  const imgBuf = Buffer.from(await imgRes.arrayBuffer());

  await writeFile(join(OUT_DIR, "reference.html"), html, "utf8");
  await writeFile(join(OUT_DIR, "reference.png"), imgBuf);

  const readme = `# Stitch reference (build detail)

- Project ID: \`${PROJECT_ID}\`
- Screen ID: \`${SCREEN_ID}\`
- Fetched: ${new Date().toISOString()}
- Files: \`reference.html\`, \`reference.png\`

Regenerate: \`STITCH_API_KEY=... node scripts/fetch-stitch-screen.mjs\`
`;

  await writeFile(join(OUT_DIR, "README.md"), readme, "utf8");
  console.log("Wrote", OUT_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
