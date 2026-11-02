# Glass web release checklist

The steps an operator follows to release the Glass Studio web app to production, in order. They
complement the [deployment preflight](DEPLOY_README.md); every step that changes production needs
the owner's explicit approval at the time. No secrets or user data belong in this file.

## What changes for users

- **Everyone is signed out once.** Web auth moves from a bearer token kept by the browser to an
  HttpOnly session cookie served from `https://www.kyarafit.com/api/auth`. Accounts, passwords and
  linked Google/Apple sign-ins are kept; people just sign in again.
- **Google and Apple sign-in break unless the new callback URLs are registered first** (steps 3 and
  4). Accounts that only use Google have no password to fall back on.
- **Web editing works** ([ADR-0006](../adr/0006-web-edits-personal-data-online.md)): builds,
  events, elements, tasks, pictures and progress updates can be created and edited while online.
- **One web address.** `kyarafit.com`, `app.kyarafit.com` and `kyarafit-web.vercel.app` redirect
  (308, path kept) to `https://www.kyarafit.com`. The redirect is in code (`web/next.config.js`),
  so it only works while those hosts still point at the production deployment.

## 1. Freeze `main`

Do not push or merge to `main` until step 7. Every production build of `main` also runs
`npx convex deploy` of that commit's `convex/` (see `web/vercel.json`), so an older `main` would
push an older backend.

## 2. Back up production

From a trusted machine, with the production deploy key:

```bash
npx convex export --prod --include-file-storage --path <secure-dir>/kyarafit-prod-<date>.zip
```

Check the archive contains the `builds` table, the stored files, and the `betterAuth` component
tables. Keep it off the repository (it contains personal data) and record its time and hash.

## 3. Google sign-in (do this at least a day early)

Google notes that changes can take from five minutes to a few hours to apply.

1. Open [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. Under **OAuth 2.0 Client IDs**, open the **Web application** client whose Client ID equals the
   production Convex `GOOGLE_CLIENT_ID`.
3. Under **Authorized JavaScript origins**, add `https://www.kyarafit.com` if it is not there.
4. Under **Authorized redirect URIs**, click **Add URI** and enter exactly (no trailing slash):
   `https://www.kyarafit.com/api/auth/callback/google`
5. **Keep** the existing `https://<production>.convex.site/auth/callback/google` entry. The rollback
   web build still uses it.
6. Click **Save**.

## 4. Apple sign-in

1. Open [Apple Developer → Certificates, Identifiers & Profiles → Identifiers](https://developer.apple.com/account/resources/identifiers/list/serviceId),
   filtered to **Services IDs**.
2. Open the Services ID that equals the production Convex `APPLE_CLIENT_ID`.
3. Next to **Sign In with Apple**, click **Configure**.
4. Under **Website URLs**:
   - **Domains and Subdomains**: add `www.kyarafit.com` (no `https://`, no path).
   - **Return URLs**: add exactly `https://www.kyarafit.com/api/auth/callback/apple`.
   - Keep the existing entries for rollback.
5. Click **Next**, **Done**, **Continue**, then **Save**.
6. `APPLE_CLIENT_SECRET` is a JWT that expires after at most six months. If it is near expiry,
   regenerate it with `npm run apple:client-secret` and set it on the production Convex deployment.

## 5. Production configuration

- **Convex (production) environment**: `SITE_URL` must be `https://www.kyarafit.com` (already
  true on 2026-11-02). Leave `AUTH_ENVIRONMENT` unset (it defaults to production).
  `ADDITIONAL_CORS_ORIGINS`, if set, may hold only `https://` origins without paths.
- **Vercel (production)**: set `NEXT_PUBLIC_APP_URL=https://www.kyarafit.com`. It drives the
  `/api` CORS header and HSTS.
- **Vercel domains**: keep `www.kyarafit.com` as the primary domain. Keep `kyarafit.com` and
  `kyarafit-web.vercel.app` assigned to the production deployment so the code redirect answers for
  them. Optionally also set a Vercel domain redirect for them to `https://www.kyarafit.com`.

## 6. Rehearse on a non-production deployment

Deploy the release commit to a development Convex deployment and a preview, then sign in with
email and password and open builds, a build detail, the planner and events. Create and edit a
build to confirm web editing. Google sign-in can only be rehearsed on a host registered with the
development OAuth client.

## 7. Release

Release backend and web together, as one Vercel production build of the release commit, at a
quiet hour. Either fast-forward or merge `main` to the release commit (the production build runs
`convex deploy`, whose schema validation is the gate), or run
`vercel deploy --prod` from a clean checkout of it. Do not promote an existing preview: previews
are built against a preview Convex URL. Expect a short sign-in outage between the Convex push and
the alias switch.

## 8. Smoke checks (within 15 minutes)

- `https://www.kyarafit.com/` and `/auth/signin` return 200.
- `https://kyarafit-web.vercel.app/home` and `https://kyarafit.com/home` answer 308 with
  `location: https://www.kyarafit.com/home`.
- Google sign-in completes a round trip; email and password sign-in works.
- After sign-in, `Set-Cookie` is `HttpOnly`, has no `Domain`, and no `set-auth-token` header is
  exposed; `/api/auth/get-session` returns the session.
- On your own account: builds list, a build detail with its cover, the planner and events render.
- **Web editing:** create a test build, rename it, add an element and a task, then delete the build.
- The deprecation banner is visible.
- `npx convex function-spec --prod` shows `replica.*` and no `sync.listChangedSince`.
- `npx convex logs --prod` for 5–10 minutes shows no failed executions.
- Ask the most active Google-only user to sign in and confirm their build count.

## 9. Rollback

The rollback is a pair; neither half works alone (`/auth` versus `/api/auth`, bearer versus cookie):

- Backend: redeploy the previous live backend revision (recorded in step 2's notes) with
  `npx convex deploy` from a detached checkout of it.
- Web: promote the previous production deployment in Vercel.
- Keep the old Google and Apple redirect URLs registered until rollback is no longer needed.
- Restore the step-2 export (`npx convex import --replace-all`) only if user rows were damaged.

## Owner walkthrough (before or right after release)

These need the owner's eyes; they were not signed off in code review:

- **Build detail** (`/build-detail/<id>`), on a desktop window and a phone:
  - The hero cover, title block and status/progress chips over the photo.
  - The work-panel tabs (Elements, Tasks, Updates, Summary): drag to nest in the element explorer,
    the element sheet (open, edit, autosave, close; it has no "Move" action yet), and adding,
    checking and nesting tasks.
  - The board strip and "Open board" (reference and process pictures): adding, removing and
    reordering pictures. The spec's Overview and Board tabs are not built; decide if they should be.
  - Progress updates: posting one with a photo, and the free-tier "publish" hint.
  - Notes, link elements, invite collaborator and photo-batch dialogs.
  - A build with no cover image (the monogram fallback with "Add a cover").
- The creation dialogs (new build, element, event, group) on desktop and as a phone sheet.
- The planner's Today / This week / Later groups.
- The write-failure toast: turn the network off, try to save an edit, and read the message.
