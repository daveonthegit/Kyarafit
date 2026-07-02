# Domain Migration — app.kyarafit.com (app) + www/apex (landing)

Target topology:

| Host                                     | Serves                                                                                | Backed by                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `app.kyarafit.com`                       | The app — all authed routes (`/home`, `/builds`, `/u/*`, `/b/*`, `/g/*`, settings, …) | the Next.js app in `web/`                                                 |
| `www.kyarafit.com` + apex `kyarafit.com` | Landing + legal + public share pages                                                  | `web/src/app/page.tsx` (landing) + `/privacy`, `/terms`, `/b`, `/g`, `/u` |
| `noreply@kyarafit.com`                   | Transactional email sender                                                            | Resend (DNS only, not a web host)                                         |

The web app is a **single** Next.js 16 deployment. The landing is the root route and the app routes are
siblings; `web/src/middleware.ts` does host-based routing so one deployment serves both hosts.

---

## What is already done in-repo (committed on `refactor/deepen-domain-modules`)

- `convex/http.ts` — `https://app.kyarafit.com` added to CORS `allowedOrigins`.
- `convex/betterAuth/auth.ts` — `https://app.kyarafit.com` added to Better Auth `trustedOrigins` (kept in
  sync with the CORS list; **both must always list the same origins** or auth returns 403).
- `web/src/middleware.ts` — host routing: on `www`/apex, app routes 308-redirect to `app.kyarafit.com`,
  landing/legal/share paths stay; on `app`, `/` 308-redirects to `/home`. **Inert on any other host**
  (localhost, previews, LAN IPs) so dev is unaffected. It takes effect only once DNS points these
  hostnames at the deployment.
- `web/env.example`, `mobile/env.example` — production notes; fixed the mobile env-var name
  (`EXPO_PUBLIC_WEB_ORIGIN` → `EXPO_PUBLIC_WEB_APP_URL`, which is what the code actually reads).

## What you must do manually (dashboards / DNS — cannot be done from the repo)

### 1. DNS (registrar / DNS host for `kyarafit.com`)

- `app.kyarafit.com` → point at the web host (Vercel: `CNAME` → `cname.vercel-dns.com`; other hosts: their target).
- `www.kyarafit.com` → same deployment (or the landing deployment if you later split them).
- apex `kyarafit.com` → landing (ALIAS/ANAME, or provider apex support; redirect to `www` if preferred).
- Resend email deliverability: add the SPF / DKIM (and DMARC) records for `noreply@kyarafit.com`
  (see `docs/integrations/RESEND_SETUP.md`).

### 2. Hosting provider (custom domains + TLS)

- Add `app.kyarafit.com` (and `www` + apex) as custom domains on the web deployment; provision TLS.
- `web/vercel.json` is the live-looking config. **Stale configs to reconcile/prune to avoid confusion:**
  `web/fly.toml` references a `Dockerfile` that does not exist; `scripts/setup-domains.sh` +
  `docs/GCP_*` describe a Go backend and image service that **do not exist in this repo** (backend is
  Convex). Do NOT run `scripts/setup-domains.sh` as-is. Pick one host and delete the losing configs.

### 3. Convex dashboard → Environment Variables

- `SITE_URL = https://app.kyarafit.com`
- `APP_URL = https://app.kyarafit.com` (welcome-email "Get Started" button)
- **Leave `CONVEX_SITE_URL` as the `*.convex.site` value** (auto-managed). Do NOT point it at kyarafit.com.
- `ADDITIONAL_CORS_ORIGINS` — only for LAN/dev origins (e.g. Expo Go device IPs).

### 4. OAuth provider dashboards — **do NOT change these**

The intuitive move (adding `app.kyarafit.com/auth/callback/...` to Google/Apple) is **wrong and breaks login.**
OAuth redirect URIs are registered against `https://<deployment>.convex.site/auth/callback/<provider>` and
**stay there** — auth is hosted on Convex, not on the app domain (see `docs/auth.md`). Only revisit these if
you change the Convex deployment or set up a Convex custom domain.

### 5. Mobile (EAS)

- Set `EXPO_PUBLIC_WEB_APP_URL=https://app.kyarafit.com` in the EAS build env and rebuild.
- No OAuth change (mobile uses the `kyarafit://` scheme).

---

## Why sessions won't drop on cutover

Auth cookies live on `*.convex.site` (`sameSite: none; secure`, no cookie `domain` set) and the session
rides the Better Auth crossDomain/bearer mechanism, not a `.kyarafit.com` cookie. Moving the web app to
`app.kyarafit.com` does **not** log users out — provided `https://app.kyarafit.com` is in the CORS +
trustedOrigins lists (it is) before you cut over.

## Subdomains deliberately NOT set up (no backing code)

`api.` (backend is `*.convex.cloud`), `images.`/`cdn.` (no image service; images come from Convex storage +
`*.supabase.co`/`googleusercontent.com`), `auth.` (would break the registered OAuth redirect URIs). Add these
only if/when real services back them.

## Not configured yet (future, if you want deep links)

No Universal Links / App Links: `mobile/app.json` has only `scheme: "kyarafit"`, and there is no
`.well-known/apple-app-site-association` or `assetlinks.json` in `web/public`. To deep-link `kyarafit.com`
URLs into the mobile app later, add `associatedDomains` + host those files on the chosen domain.
