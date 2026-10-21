/**
 * Per-request Content-Security-Policy for documents (set by `src/middleware.ts`).
 *
 * Scripts run only with this request's nonce; `'strict-dynamic'` extends that trust to scripts
 * Next.js and nonce-bearing scripts load, so host allowlists and `'unsafe-inline'` are not needed.
 * `'wasm-unsafe-eval'` permits compiling the wa-sqlite WebAssembly module only, not JS `eval`.
 * Development adds `'unsafe-eval'` for React's dev tooling; production never does.
 * Styles keep `'unsafe-inline'`: React `style` props and runtime-injected component styles
 * (cropper, motion) are not script execution, and nonce-tagging every injector is not possible.
 */
export function buildContentSecurityPolicy(nonce: string, { development = false } = {}): string {
  return [
    "default-src 'self'",
    [
      "script-src 'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "'wasm-unsafe-eval'",
      ...(development ? ["'unsafe-eval'"] : []),
    ].join(" "),
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
