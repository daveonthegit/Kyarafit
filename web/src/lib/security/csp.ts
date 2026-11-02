/**
 * Per-request Content-Security-Policy for documents (set by `src/proxy.ts`).
 *
 * Scripts run only with this request's nonce; `'strict-dynamic'` extends that trust to scripts
 * Next.js and nonce-bearing scripts load, so host allowlists and `'unsafe-inline'` are not needed.
 * `'wasm-unsafe-eval'` permits compiling the wa-sqlite WebAssembly module only, not JS `eval`.
 * The script-only criterion does not cover styles. Styles keep `'unsafe-inline'` because
 * React style attributes (including motion transforms) cannot be authorized with a style nonce,
 * and the cropper/component libraries inject runtime styles without this request's nonce.
 * `next dev` alone adds `'unsafe-eval'`: webpack dev and React Refresh evaluate modules with `eval`,
 * so without it development pages render but never hydrate. Production builds never get it.
 */
export function buildContentSecurityPolicy(
  nonce: string,
  development = process.env.NODE_ENV === "development"
): string {
  const scripts = [
    "script-src 'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    "'wasm-unsafe-eval'",
  ];
  if (development) scripts.push("'unsafe-eval'");
  return [
    "default-src 'self'",
    scripts.join(" "),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "connect-src 'self' https: *.convex.cloud *.convex.site wss:",
    "img-src 'self' data: https: blob:",
    "media-src 'self' blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "worker-src 'self' blob:",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
}

/** 128 random bits, base64: a fresh nonce for every document response. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
