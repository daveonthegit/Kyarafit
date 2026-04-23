# Follow-up: public + unlisted build viewer (mobile)

Companion to the web effort: authoritative plan is **[../PUBLIC-BUILD-DETAIL-PLAN.md](../PUBLIC-BUILD-DETAIL-PLAN.md)** (editorial-informed UI + parity with private `build-detail/[id]`, Convex bundle, toggles, route cleanup).

## What is the “unlisted share” page (web)?

| Route                   | When it applies                                                                                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`/b/[buildId]`**      | Build **`visibility === "public"`**. Listed in Discover and addressable by Convex build id in the URL.                                                                                                                                  |
| **`/b/s/[shareToken]`** | Build is **`visibility === "unlisted"`**. The app stores a secret **`shareToken`** on the build; **only people who have the link** can open it. It does **not** appear in Discover. The share URL uses the token, not the raw build id. |

Implementation today: [`web/src/app/b/s/[shareToken]/page.tsx`](../../web/src/app/b/s/[shareToken]/page.tsx) loads the build via [`builds.getByShareToken`](../../convex/builds.ts). UI should stay aligned with `/b/[buildId]` after the public build page work (single shared viewer component).

**Summary:** “Unlisted share” = **private to the link**, not indexed for browsing; “Public” = **community-visible** + stable id URL.

---

## Mobile rewrite scope (deferred)

Execute **after** the web + Convex pieces land (`getPublicViewerBundle` or equivalent, `publicViewerSettings`, hardened list queries).

1. **Universal links / app links** — Open `https://<app-domain>/b/<buildId>` and `https://<app-domain>/b/s/<shareToken>` in the app when installed (or fall back to in-app WebView / system browser per product choice).
2. **Read-only screens** — Mirror the web public viewer (sections gated by owner toggles); no edit affordances. Reuse strings/layout patterns from authenticated [`DetailBody`](../../mobile/src/screens/build-detail/DetailBody.tsx) only where it stays read-only; do not require sign-in to _view_ public/unlisted links.
3. **Auth optional** — Likes/comments if the API requires a user: show CTAs to sign in, same as web.
4. **Parity rule** — Track against [`rules/mobile-parity.mdc`](../../.cursor/rules/mobile-parity.mdc) once routes exist.

This file is the backlog hook so the mobile rewrite schedule stays focused on authenticated parity first; wire public viewer when the shared backend contract is stable.
