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

- Auth origins use the shared runtime policy described in [Authentication](../auth.md#origin-configuration--critical), not separately maintained CORS/CSRF lists.
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
- Configure `AUTH_ENVIRONMENT` and any `ADDITIONAL_CORS_ORIGINS` according to the
  [auth origin policy](../auth.md#origin-configuration--critical); never put LAN/Expo origins
  on the production deployment.

### 4. OAuth provider dashboards

Auth is served from the app origin (`SITE_URL/api/auth`, proxied to Convex), so the registered
redirect URIs follow `SITE_URL`: `https://app.kyarafit.com/api/auth/callback/<provider>` (see
[Authentication → OAuth Setup](../auth.md#oauth-setup)). Register them before switching `SITE_URL`.

### 5. Mobile (EAS)

- Set `EXPO_PUBLIC_WEB_APP_URL=https://app.kyarafit.com` in the EAS build env and rebuild. Its host
  is the claimed OAuth return domain (Universal Links / App Links).
- Set `APPLE_TEAM_ID` and `ANDROID_CERT_SHA256_FINGERPRINTS` on the web deployment so
  `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` are served.

---

## Sessions and the cutover

Web sessions are host-only HttpOnly cookies on the app origin (no cookie `domain`). Moving the web
app to `app.kyarafit.com` therefore starts fresh web sessions there; mobile sessions (bearer tokens
in the device keychain) are unaffected. `https://app.kyarafit.com` must be `SITE_URL` and inside the
shared origin policy before you cut over (see [Authentication](../auth.md#origin-configuration--critical)).

## Subdomains deliberately NOT set up (no backing code)

`api.` (backend is `*.convex.cloud`), `images.`/`cdn.` (no image service; images come from Convex storage +
`*.supabase.co`/`googleusercontent.com`), `auth.` (auth is served from the app origin at `/api/auth`). Add these
only if/when real services back them.

## Claimed links

The app claims only `https://app.kyarafit.com/native/*` (the OAuth return). `mobile/app.config.js`
adds the associated domains / `autoVerify` intent filter for the `EXPO_PUBLIC_WEB_APP_URL` host, and
the web app serves the association files from `web/src/lib/appLinks.ts`. To deep-link more paths
later, extend `CLAIMED_PATHS` there and the intent filter together.
