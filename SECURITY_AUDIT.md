# Security Audit — Hardening Pass

**Branch:** `security/hardening-pass`  
**Date:** 2025-03-05  
**Scope:** API protection, auth/session security, secret handling, input sanitization.

---

## 1. Findings and Fixes Implemented

### A. API rate limiting

| Finding                                                                                                                | Fix                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth API (Next.js proxy at `/api/auth/*`) had no rate limiting; abuse possible (credential stuffing, OTP brute force). | Added in-memory rate limiter in `web/src/lib/rate-limit.ts`. Applied in `web/src/app/api/auth/[...all]/route.ts`: **30 requests/minute per IP** for auth. Responses return `429 Too Many Requests` with `Retry-After` header.                        |
| Convex HTTP auth (`*.convex.site/auth/*`) is called directly by clients; Next.js proxy is only one path.               | Rate limiting on the proxy protects server-side auth flows that use the proxy. **Recommendation:** For production, add rate limiting at edge/CDN for your Convex deployment URL, or use Convex’s recommended approach if they provide rate limiting. |

**Endpoints rate-limited:**

- `GET /api/auth/*` — 30 req/min per IP
- `POST /api/auth/*` — 30 req/min per IP

**Thresholds:** 1-minute window, 30 requests per window for auth. Documented in `web/src/lib/rate-limit.ts` (`RATE_LIMIT` export).

---

### B. Input validation and sanitization

| Finding                                                                                                                                                 | Fix                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Convex mutations accepted unbounded strings (names, notes, labels, tags, dates). Risk: storage abuse, XSS if rendered without escaping, malformed data. | Added `convex/lib/validation.ts`: `sanitizeString`, `sanitizeAndLimit`, `sanitizeOptional`, `validateDateString`, `MAX_LENGTH` constants.                                                                                                                                                                                                                         |
| No server-side length or format checks on user-controlled text.                                                                                         | Applied validation in Convex mutations: **closetItems** (name, category, notes, tags, status), **builds** (name, character, notes, status, targetDate), **conventions** (name, location, startDate, endDate), **conventionDayPlans** (date, notes), **buildTasks** (label), **packingListItems** (label, date), **users** (email length, name, image URL length). |
| Verify-email page forwarded `token` query param to Convex without validation.                                                                           | Validate `token` on verify-email page: alphanumeric + `_`/`-`, length 1–512, then redirect. Reduces header injection / malformed redirect risk.                                                                                                                                                                                                                   |

**Max lengths (examples):** name 500, notes 10_000, label 500, character 200, location 300, tag 100, category 100, date 20, URL 2048, email 320.  
**Sanitization:** Trim, normalize line endings, strip control characters. Dates must be `YYYY-MM-DD`. Optional URLs validated with `new URL()`.

---

### C. Secrets and API key exposure

| Finding                                   | Fix                                                                                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Risk of secrets in repo or client bundle. | Audited repo: no hardcoded API keys or tokens in application code. Secrets (BETTER_AUTH_SECRET, RESEND_API_KEY, OAuth client secrets) are used only in Convex (server) or backend-archived (env). |
| Client env usage.                         | Confirmed: only `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL` (web) and `EXPO_PUBLIC_*` (mobile) are used in client code. No secret env vars exposed to the client.                     |
| Email logging.                            | `convex/emailHelpers.ts` previously logged recipient address. Now logs only “Sent successfully, subject: …” to avoid PII in logs.                                                                 |
| .env.example.                             | Updated with a **SECURITY** note: do not commit real secrets; Convex secrets only in Convex Dashboard; client-safe vars only in NEXT*PUBLIC*_ / EXPO*PUBLIC*_.                                    |

**No exposed API keys or secrets found in source.** No rotation required from this audit; ensure BETTER_AUTH_SECRET and OAuth secrets are set only in Convex Dashboard.

---

### D. Auth hardening

| Finding                                                              | Fix                                                                                                                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Session token stored in localStorage (cross-origin design per docs). | Documented in `bearer-storage-plugin.ts`: only the session token is stored; no secrets or refresh tokens. Better Auth handles JWT/session lifecycle on the server. |
| Need to confirm no client-side secret storage.                       | Verified: auth client and bearer plugin do not store BETTER_AUTH_SECRET or any server secret. Only opaque session token and public Convex URLs.                    |
| Verify-email token passed in URL.                                    | Token format and length validated before redirect (see B).                                                                                                         |

**JWT/refresh flow:** Handled by Better Auth and Convex component; signing and verification are server-side. No changes to JWT config in this pass. Session expiry is controlled by Better Auth; ensure `session.expiresIn` is set appropriately in Convex Better Auth config if you need shorter expiry.

**Logout:** Sign-out clears the stored bearer token via `setStoredBearerToken(null)` in the bearer plugin when `/sign-out` is called.

**CORS / trusted origins:** Already configured in `convex/http.ts` and `convex/betterAuth/auth.ts`; keep `allowedOrigins` and `trustedOrigins` in sync (see `docs/auth.md`).

---

### E. Client-side storage and frontend security

| Finding                                                                             | Fix                                                                           |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| No use of `dangerouslySetInnerHTML` or unsanitized markdown in the scanned web app. | None found; no change.                                                        |
| Session token in localStorage.                                                      | By design for cross-origin; documented that only the session token is stored. |

---

### F. Security headers and config

| Finding                                                                     | Fix                                                                                                                                                                                                       |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CSP missing.                                                                | Added **Content-Security-Policy** in `web/next.config.js`: default-src 'self'; script/style/connect/img/font scoped for Next.js and Convex (_.convex.cloud, _.convex.site, wss:); frame-ancestors 'self'. |
| HSTS not set.                                                               | Added **Strict-Transport-Security** (max-age=31536000; includeSubDomains; preload) for production when `NEXT_PUBLIC_APP_URL` is HTTPS.                                                                    |
| X-Frame-Options, X-Content-Type-Options, Referrer-Policy, X-XSS-Protection. | Already present; left as-is.                                                                                                                                                                              |
| API CORS.                                                                   | API route uses `NEXT_PUBLIC_APP_URL` (or localhost) as `Access-Control-Allow-Origin`, not a wildcard.                                                                                                     |

---

### G. CSP review (2026-03-05)

Content-Security-Policy in `web/next.config.js` was reviewed to ensure it does not block required resources.

**What the app uses and how CSP allows it:**

| Resource | Where used | Directive | Allowlist |
| -------- | ---------- | --------- | --------- |
| Google Fonts stylesheet | `layout.tsx` &lt;link&gt;, `globals.css` @import (Inter, Playfair, Bodoni, Montserrat, Material Symbols) | style-src | 'self' 'unsafe-inline' https://fonts.googleapis.com |
| Font files (woff2) | Loaded by Google Fonts CSS from gstatic | font-src | 'self' data: https://fonts.gstatic.com |
| Convex data & auth | useQuery/useMutation, fetch(uploadUrl), Better Auth | connect-src | 'self' https: \*.convex.cloud \*.convex.site wss: |
| Convex storage images, OAuth avatars, Unsplash (demo) | &lt;img src&gt;, ResolvedImage, ImageUpload | img-src | 'self' data: https: blob: |
| Next.js / React | Inline scripts, eval (dev/build) | script-src | 'self' 'unsafe-inline' 'unsafe-eval' |
| Embedding | Prevent app from being framed | frame-ancestors | 'self' |

**Fixes applied:** Previously font-src did not allow `https://fonts.gstatic.com` and style-src did not allow `https://fonts.googleapis.com`, which caused Material Symbols (and other Google Fonts) to fail to load and show icon names as text. Both origins are now allowlisted.

**Hardening added:** `object-src 'none'` (blocks plugins/Flash); `base-uri 'self'` (prevents &lt;base&gt; tag injection).

**Not blocked:** Convex, auth, Google Fonts, external images (Convex storage, Google avatars, Unsplash in demo), OAuth (full-page redirects, not fetch). If you add Stripe, analytics, or other third-party scripts/frames, update script-src or frame-src in `web/next.config.js`.

---

## 2. Risks Accepted / Architecture Notes

- **Rate limiting:** In-memory limiter is per-instance. For multi-instance or serverless, use a shared store (e.g. Redis) or edge rate limiting; document in runbooks.
- **Auth traffic to Convex:** Many clients call `*.convex.site/auth/*` directly. Rate limiting on the Next.js proxy only affects requests that go through the app. Consider edge or Convex-level rate limiting for auth.
- **Session in localStorage:** Required for cross-origin (app origin vs Convex). Session token is opaque; theft risk is mitigated by HTTPS and short-lived sessions if configured in Better Auth.

---

## 3. Remaining recommendations (follow-up)

1. **Rate limiting at edge:** Put rate limiting (e.g. Cloudflare, GCP) in front of Convex HTTP base URL for auth endpoints.
2. **Session expiry:** Review Better Auth / Convex session config and set appropriate `session.expiresIn` and refresh behaviour.
3. **CSP tuning:** If you add more third-party scripts or styles, update CSP in `next.config.js`; consider reporting (report-uri / report-to) for violations.
4. **Stripe / webhooks:** If you add Stripe or other webhooks, validate signatures and consider rate limiting.
5. **Audit log:** For sensitive actions (e.g. password reset, email change), consider logging (without PII) for security reviews.

---

## 4. Files changed (summary)

| Area              | Files                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rate limiting     | `web/src/lib/rate-limit.ts` (new), `web/src/app/api/auth/[...all]/route.ts`                                                                       |
| Validation        | `convex/lib/validation.ts` (new), `convex/closetItems.ts`, `convex/builds.ts`, `convex/conventions.ts`, `convex/buildTasks.ts`, `convex/users.ts` |
| Verify-email      | `web/src/app/auth/verify-email/page.tsx`                                                                                                          |
| Secrets / logging | `convex/emailHelpers.ts`, `.env.example`                                                                                                          |
| Auth docs         | `web/src/lib/auth/bearer-storage-plugin.ts`                                                                                                       |
| Headers           | `web/next.config.js`                                                                                                                              |
| Audit doc         | `SECURITY_AUDIT.md` (this file)                                                                                                                   |

---

## 5. Manual steps (if any)

- **None required** for the changes in this pass.
- Ensure Convex env has `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, and optional `GITHUB_*`, `RESEND_API_KEY` set in the Convex Dashboard only.
- For production HTTPS, set `NEXT_PUBLIC_APP_URL` to your production origin so HSTS and CSP apply correctly.
