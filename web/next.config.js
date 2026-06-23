/** @type {import('next').NextConfig} */
// Skip lockfile patching in npm workspaces (avoids ENOWORKSPACES and patch script errors)
if (!process.env.NEXT_IGNORE_INCORRECT_LOCKFILE) {
  process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = "1";
}
const nextConfig = {
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
      // CSP: allow self, Convex, auth, fonts, and inline/eval required by Next.js.
      // If you add analytics, Stripe, or other third-party scripts/frames, update the relevant directive.
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "connect-src 'self' https: *.convex.cloud *.convex.site wss:",
          "img-src 'self' data: https: blob:",
          "font-src 'self' data: https://fonts.gstatic.com",
          "frame-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "frame-ancestors 'self'",
        ].join("; "),
      },
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
