# 03 · Component changes — file by file

Paths relative to repo root. "Restyle" = keep logic/props/data flow, change presentation only.

## Navigation / shell

- `web/src/components/layout/WebSidebar.tsx` → **replace with `GlassTopBar`** (new file, same nav source `@kyarafit/design-system` NAV_SECTIONS_PRIMARY + NAV_ICON_MAP): wordmark (italic Bodoni 21px) · inline uppercase nav (10px/0.18em, active = light + 1.5px underline) · search icon · solid light "New …" pill (context-aware label from `ADD_MENU_ITEMS`, replaces GlobalFAB on desktop). Sticky, `--glass-bg-bar`, blur 18px, bottom border `--glass-divider-strong`. Keep `getActiveSection` highlighting and i18n keys.
- `web/src/components/layout/GlobalFAB.tsx` → desktop: retired (absorbed into GlassTopBar pill + its expand menu). Mobile: keep component, restyle as solid light pill above the tab bar; menu becomes a glass sheet.
- `web/src/components/layout/BottomNav.tsx` → restyle: `--glass-bg-bar` + blur 24px + top `--glass-divider-strong`; active tab = light + 28×2px top notch (was ink notch on panel); inactive 55% light. Same 5 sections, same safe-area padding.
- `web/src/components/layout/PageHeader.tsx` → becomes `PhotoHeadline`: eyebrow meta (10px/0.28em/75%) + italic Bodoni headline (64–92px) + optional hairline progress row, positioned lower-left over the backdrop. Search moves to the bar. Filter children render as text-underline tabs or glass pills (see 6c/6d), NOT ControlPills on cream.
- `web/src/components/layout/AdaptiveModal.tsx` → restyle scrim to rgb(12 11 20/0.6) + blur; dialog surface becomes **heavier glass** (bg 0.14, blur 30px, border 0.22, deep shadow — the auth-card/element-sheet weight) with glass-outline form fields inside, NOT cream. Mobile: glass bottom sheet (`--glass-radius-sheet`).

## Backdrop (new)

- New `web/src/components/layout/PhotoBackdrop.tsx`: renders `ResolvedImage` full-bleed + `--scrim-page-vertical` (+ `--scrim-page-right` when panelled) + optional Ken-Burns. Accepts the same `imageStorageId/imageUrl` refs as `ResolvedImage`. Every studio route wraps content in it.

## Explorers (restyle ONLY — logic is correct)

- `web/src/components/builds/explorer/BuildExplorerRow.tsx`: keep structure, pointer handlers, `data-node-drop-*`, `useLongPressDrag`. Swap classes: row hover `rgb(255 253 248/0.06)`; selected `--glass-bg-active` + inset ring; drop before/after pseudo-elements → `--drop-line` style (2.5px, glow, start dot); drop into → `--drop-into-ring`; `STATUS_TONE_CLASSES` → on-glass chip tokens when inside a glass panel (prop or context flag `surface="glass"`); thumbnails keep 38–40px rounded-lg with `--glass-border`.
- `web/src/components/builds/explorer/BuildExplorerToolbar.tsx`: search becomes inline text row in panel header; "New main element" moves to the top bar pill; "Link" stays as outline glass chip.
- `web/src/components/builds/explorer/BuildExplorerBreadcrumb.tsx`: JetBrains Mono 10px light-60%, `raiden-shogun / all elements` style, in panel header.
- `web/src/components/builds/explorer/useExplorerDrag.ts` + `useLongPressDrag.ts`: unchanged. Add drag-preview portal styled per surface rule 8.
- `web/src/components/builds/WorkflowTree.tsx` + `web/src/components/planner/PlannerWorkflowTaskUi.tsx`: same treatment; round 21px checkboxes (border 2px `--media-fg-45`, done = solid light with ink check), overdue meta in `--on-glass-danger`, "Details ▸" disclosure kept (progressive disclosure REQ-063), nested children behind 1px light-14% left rail (never stacked borders).

## Cards / media

- `web/src/components/builds/BuildPortfolioCardWeb.tsx`: grid variant survives (shelves, mobile); comfortable variant replaced by the full-bleed pager/featured treatment. Keep `progressRingGeometry` ring; on shelves swap ring for hairline progress bar + tabular % where space is tight. Selected/featured card gets `outline:1.5px rgb(255 253 248/.6)` inset.
- `web/src/components/builds/BuildVisualBoard.tsx`: **keep tabs (All/References/Progress/Elements), fullscreen, portal, masonry mechanics.** Change: masonry becomes explicit N-column flex (4 desktop / 2 mobile) for Pinterest balance; tiles radius 16px on `--studio-wall`; hover = scrim + glass icon buttons (open_in_full, more_horiz) + meta reveal; element tiles show serif name + progress hairline; "Add pin" = dashed light-35% tile. Tab pills: active = solid light/ink text, inactive = glass chip.
- `web/src/components/ui/image-gallery.tsx` / `BuildReferenceImagesSection.tsx` / `BuildProcessPicturesSection.tsx`: fold into board + bottom gallery strip on Build detail (6b). Keep upload/reorder logic.
- `web/src/components/builds/BuildProgressTimeline.tsx`: restyle into the glass panel (light dot + light-20% rail, meta date line incl. "· Published" when posted); composer becomes single underline row + "Post" text button. All gating logic (`can(tier,"social_post")`) unchanged.

## Feedback

- `web/src/components/SyncStatus.tsx`: ~~pill becomes glass chip bottom-left, above mobile tab bar~~ **superseded by ADR-0002** (owner, phase-7.1 device check): same gate + logic, but it renders as the "Cloud sync" section on Settings → Backup & data (mobile mirror: `SyncStatusSection` on Settings → Offline). No omnipresent floating status chrome; only transient banners (offline strip, retention notice) float.
- `web/src/components/OnlineOnlyBanner.tsx` / `UpgradePrompt.tsx`: on glass surfaces render as a panel-header strip (icon + text + underline action), on cream keep current style. On social surfaces (feed/discover/groups, ref 12) the banner is the glass strip variant.
- `web/src/components/social/PublicBuildCard.tsx`: restyle to a 4:5 photo tile (radius 14px, top scrim) — top-left owner chip when `showOwner`, bottom source/name serif + like/comment counts. Keep all like/query props. Shared by feed + discover.
- `web/src/components/ui/EmptyState.tsx`: add `surface="glass"` variant (light 200-weight icon + light text); used on feed/discover/groups empties.
- `web/src/components/ui/Button.tsx`: `PhotoPill` (new, `web/src/components/ui/PhotoPill.tsx`) becomes the app-wide button — solid | outline variants per surface rule 5. The cream `Button` survives only on standalone legal pages/email.
- `web/src/components/ui/ControlPill.tsx`: glass chip style app-wide (solid-light active, glass-outline inactive) per 6c/6d/11a.

## Mobile app (`mobile/`)

Mirror the same mapping onto the RN components in `mobile/src/ui` + `mobile/src/components` (parity rule PAR-1): tab bar → BlurView glass; screens per `04-screens.md` 7a–7e; explorer bottom sheet keeps long-press drag. Use expo-blur; fall back to `rgb(20 19 32/0.85)` where blur is unavailable. Add glass tokens to `design-system/design_tokens.json` (new `glass` block) + `rn_tokens.ts` so both platforms read one source (CMP-2).

## Auth & Settings (glass, not cream) — ref 11a/11b

- `web/src/app/settings/page.tsx` (+ `/account`, `/subscription`, `/notifications`, `/data`): rebuild the body as a glass work panel (same as build detail 6b) centered on `--studio-wall` under the glass top bar — light-on-glass, glass dividers, segmented active = solid light/ink, links = underlined light meta, sign-out = on-glass danger. `SectionCard` and the cream `--kyar-*` usage here are retired. `/subscription` renders `SUBSCRIPTION_PLANS` as glass plan cards.
- `web/src/app/auth/{signin,signup,verify-email,reset-password}/page.tsx`: full-bleed dark photo + `--scrim-page-vertical`, centered heavier-glass card (bg 0.14, blur 30px) with glass-outline fields, glass-outline OAuth pills, solid-light "Sign in" primary, underlined-meta links, and on-glass alert tints (danger/done chips) instead of red-50/green-50 boxes.
- `web/src/app/{terms,privacy}/page.tsx`: onto glass too — glass top bar over `--studio-wall` + a centered glass reading panel (max ~760px, bg 0.10, blur 24px): serif title, meta eyebrow, summary chip (light-6% inset), prose sections (serif italic h2, body at ~72% light, bullet dots at 50%, inline links = underlined light meta). No cream anywhere in the product now.
- Reviewer rule: glass everywhere inside the product; cream survives only in transactional email.

## Landing (`web/src/components/landing/`) — COMMITTED ref `Landing Live.dc.html`

Rebuild `page.tsx` to four sections (hero → before/after → pricing → closing CTA); the old scrolly/device/workflow sections are retired. It's a scroll-driven page — a single throttled `scroll` rAF handler drives header-glass, hero zoom/fade, and parallax; one `IntersectionObserver` drives section reveals + fires the self-playing task demo once. Everything gated on `prefers-reduced-motion`.

- `LandingSiteHeader.tsx`: fixed, transparent → glass past 40px (bg-bar 0.08, blur 18px, `--glass-divider-strong` bottom border). Remove `ThemeToggle`. CTA copy is "Start planning" everywhere (single conversion event).
- `LandingHeroSection.tsx`: **`remotion/HeroVideoPlayer` + the type-wall/ticker are retired.** Full-bleed dark photo + `--scrim-page-right`/`--scrim-page-vertical`; lower-left headline "Made by hand. / Planned to the seam." On scroll the photo layer zooms 1→1.12 & drifts down ~0.22×vh while copy eases up −60px and fades out by ~0.7 vh. Quiet "SCROLL" hairline cue at the foot.
- **New `LandingBeforeAfter.tsx`** (replaces `LandingProductScrollySection` + `LandingMiniAppFrame`, both retired): left studio-wall column with the tilted decaying `.xlsx` mock; right build-photo column with ONE glass task panel that self-plays on first intersection (rows check in sequence, progress 52→68% counting up, one open row with on-glass danger). Reuse `landingMock.ts` task data.
- **New `LandingPricing.tsx`**: reads `SUBSCRIPTION_PLANS` from `@kyarafit/design-system/domain/subscriptionPlans` — do NOT hardcode prices. One bordered 3-column container (dividers, no nested cards), Pro column highlighted (bg 0.07 + "most popular"), columns stagger-reveal. `formatUsdPrice`/`formatPlanStorage` for all figures.
- `LandingWorkflowSection.tsx` / `LandingDeviceShowcaseSection.tsx`: retired from the page (feature enumeration now lives in the before/after + pricing story). Keep the files only if reused elsewhere; otherwise delete.
- Closing CTA: full-bleed convention photo parallaxing ~0.10× + top scrim, centered serif 60px + solid pill. `LandingFooterStrip.tsx` + `LandingMediaDisclaimer.tsx` restyle to on-photo meta links at 55% light pinned to the section's bottom scrim (no separate cream footer band).
