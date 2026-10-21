/** @type {import('next').NextConfig} */
// Skip lockfile patching in npm workspaces (avoids ENOWORKSPACES and patch script errors)
if (!process.env.NEXT_IGNORE_INCORRECT_LOCKFILE) {
  process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = "1";
}
const nextConfig = {
  // convex deploy runs from the repo root, where it detects no Next.js framework
  // and supplies CONVEX_URL / CONVEX_SITE_URL. Inline those canonical URLs for
  // both server-side Better Auth and browser clients. Prefer the selected
  // deployment over any stale public values; public-only local builds still work.
  // https://docs.convex.dev/production/hosting/vercel
  // https://labs.convex.dev/better-auth/framework-guides/next
  env: {
    NEXT_PUBLIC_CONVEX_URL: process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL,
    NEXT_PUBLIC_CONVEX_SITE_URL:
      process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  },
  output: "standalone", // Enable standalone output for optimized Docker builds
  typescript: {
    ignoreBuildErrors: false,
  },
  // Note: eslint config removed as it's no longer supported in Next.js 16
  // Use next lint command directly or configure in eslint.config.mjs
  // Disable static generation for error pages to avoid prerendering issues
  async redirects() {
    return [];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "via.placeholder.com", pathname: "/**" },
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "avatars.githubusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/**" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
    ],
  },
  async headers() {
    const isProduction = process.env.NODE_ENV === "production";
    const appOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const defaultHeaders = [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-XSS-Protection", value: "1; mode=block" },
      // Content-Security-Policy is per request (nonce-based) in src/middleware.ts.
    ];
    if (isProduction && appOrigin.startsWith("https://")) {
      defaultHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      });
    }
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: appOrigin,
          },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          // API responses are data (plus Better Auth's static error page), never app documents.
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; frame-ancestors 'none'",
          },
        ],
      },
      {
        source: "/:path*",
        headers: defaultHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
