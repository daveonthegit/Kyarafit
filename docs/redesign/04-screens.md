# 04 · Screen specs (desktop 1280+ / mobile 390)

Reference ids are options in the approved exploration doc. Data shown is illustrative; wire to the existing Convex queries/offline overlays already powering each route.

## Landing page — `web/src/app/page.tsx` + `web/src/components/landing/*` · COMMITTED ref: `explorations/Landing Live.dc.html` (evolved from option 10b)
Cream is retired from the marketing site; the landing speaks the app's glass language on a dark studio-wall/photo base. **This is a scroll-driven page — motion is part of the spec, not decoration.** Four sections. It's a *planner*, not an "archive/portfolio" — never use archive/lookbook/"est." framing in landing copy.

**Global motion (all via one throttled `scroll` rAF handler + `IntersectionObserver`; every effect gated behind `prefers-reduced-motion`):**
- Header: fixed, transparent over the hero; past 40px scroll it transitions to the glass bar (bg 0.08, blur 18px, bottom hairline). No `ThemeToggle` (photo-dark by nature).
- Section reveals: any block with a reveal role starts `opacity:0; translateY(26px)` and eases in (0.7s `--ease-out-strong`) when it crosses ~20% into view; stagger siblings by 120ms (pricing columns, spreadsheet card, task panel).
- Reduced motion: reveals resolve to final state immediately; parallax/zoom disabled; the demo shows its end state.

**S1 · Hero — full-bleed photo, cinematic scroll exit.** One full-bleed cosplay photo (dark, dramatic — e.g. a stage/black-backdrop shot) with `--scrim-page-right` + `--scrim-page-vertical`. Headline lower-left: eyebrow "The cosplay studio planner" (10px/0.3em), italic Bodoni `clamp(56px,7.5vw,100px)` "Made by hand. / Planned to the seam.", 16px subcopy at 80%, then solid light pill "Start planning — free" + meta "No account · runs on your device". **On scroll:** the photo layer slowly zooms (scale 1→1.12) and drifts down (~0.22×vh) while the copy eases up (−60px) and fades (opacity→0 by ~0.7 vh) — the hero recedes as the page enters. Quiet "SCROLL" cue + fading hairline centered at the foot. (No card-divided type-wall, no ticker tape — both were rejected.)

**S2 · Retire the spreadsheet — before/after split.** Two-column: left on studio wall = "Before" eyebrow, serif 52px "Retire the spreadsheet.", body, and a tilted (−2°) decaying `.xlsx` mock (cream sheet, mono cells, `#REF!`/"DO NOT FORGET" in red). Right = full-bleed build photo + top scrim, "After" eyebrow, and ONE glass task panel (bg 0.10, blur 24px) that **self-plays when scrolled into view**: two rows check off in sequence (circle fills light, check pops in scale 0.4→1, label strikes + fades to 55%), progress hairline animates 52%→60%→68% with the % readout counting up; a third row stays open with an on-glass-danger "Due Fri".

**S3 · Pricing — real tiers from `subscriptionPlans.ts`.** Studio-wall section, serif 48px "Priced like a coffee. Not like software." + supporting line. One bordered container, 3 equal columns (dividers, no nested cards): **Free $0** (unlimited builds · offline · full export; underline "Start free"), **Pro $3/mo** (highlighted: bg 0.07, "most popular"; cloud sync & backup · all devices · 2 GB · collab · $30/yr; solid pill "Go Pro"), **Supporter $5+/mo** (PWYW $5–$50 · funds dev; underline "Support us"). Columns stagger-reveal.

**S4 · Closing CTA + footer — photo, parallax.** Full-bleed convention photo (parallaxes ~0.10× behind the content) + top scrim; centered serif 60px "The plan starts tonight." + solid pill "Start planning — free" + reassurance meta. Footer pinned to the section's bottom scrim: hairline top border, wordmark + © + Media disclaimer / Privacy / Terms meta links at 55% light.

**Implementation notes:** parallax targets carry a per-element rate; the hero photo + closing photo are the two heaviest movers — use `will-change:transform` and a single rAF loop. All demo state (checkbox fills, progress) is JS-driven, fired once on first intersection. Copy CTAs everywhere say "Start planning" (signup is the single conversion event). Mobile: hero copy full-width lower-left, subcopy/pill stack; pricing columns stack vertical; the before/after becomes stacked (spreadsheet above, photo+panel below).

## Builds overview — `web/src/app/builds/page.tsx` · ref 1b, mobile 7b
- Backdrop: featured build photo (most recently touched in-progress). Headline lower-left: eyebrow "Featured · Project NN · status", name 88px, progress hairline (260px) + % + next-task/due meta.
- Bottom glass shelf: "The archive · NN" + filter tabs (All/In progress/Planning) + 4-col grid of 150px poster tiles (scrim, 9px meta "NN · status · %", serif name 17px). Featured tile = light outline. Overflow scrolls horizontally.
- Mobile 7b: full-bleed pager (one build per swipe), pager dots, action row: solid pill "Open build" + glass pill "Board"; grid_view icon toggles a 2-col tile grid.

## Home — `web/src/app/home/page.tsx` · ref 6a, mobile 7a
- Backdrop: most-urgent build's photo. Headline: date eyebrow + factual serif statement ("Two things due, 26 days to Anime Expo.") — compose from due-count + next event countdown.
- Right glass panel "What's due": ≤3 rows (overdue first, `--on-glass-danger`), then next event row (packing count + countdown). Footer link → Planner.
- Bottom shelf: "In the studio · NN" build tiles as in 1b.
- Mobile 7a: same stack vertically: headline → glass agenda card → horizontal studio strip → glass tab bar.

## Build detail — `web/src/app/build-detail/[id]/page.tsx` · ref 6b
- Backdrop: build hero (existing `BuildHeroCropModal` crop). Left: breadcrumb eyebrow ("The archive ▸ Project NN · status"), name 72px, progress hairline + task count, meta triplet (Character / Debut / Spend from cost rollup).
- Right glass work panel with tabs Overview · Elements · Tasks · Board · Updates (Elements/Tasks tabs render the explorers inside this same panel — one panel, swapped content). Overview = What's next (2 rows) + Timeline (2 latest) + composer footer ("What progress did you make?" underline + Post).
- Bottom glass strip: board preview thumbs + "Open board".

## Element explorer — Elements tab · ref 4a, mobile 7c
- Panel header: search row + Link chip; mono breadcrumb; footer: mono cost/node rollup + "Expand all".
- Rows per surface rule 8 with thumbnails, nodeType icons (checkroom/inventory_2), on-glass status chips, children behind light left rail.
- Mobile 7c: glass bottom sheet (drag grip, 20px top radius) over the build photo; long-press drag; helper line "Long-press a row to drag…".

## Task explorer — Tasks tab / build WorkflowTree · ref 4b
- Same grammar; 21px round checkboxes; parent rows show subtask rollup + mini progress hairline (56px); blocked meta in warn chip; overdue in on-glass danger; "Details ▸" opens status/priority/dependencies inline.
- Footer composer: "Add a task… press ⏎ to save, Tab to nest".

## Planner — `web/src/app/planner/page.tsx` · ref 3b, mobile 7e
- Backdrop: photo of the build owning the most urgent task. Left: date eyebrow + "What's due" 76px + prose line naming the urgent build.
- Right glass panel grouped Today / This week / Later (Later collapsed, "Show ▾"); build filter tabs in header; rows = round checkbox + title + build/status meta + trailing due date.

## Visual board — Board tab, `BuildVisualBoard.tsx` · ref 6c, mobile 7d
- `--studio-wall` backdrop. Header: "The board" serif + pin count; tab pills All/References/Progress/Elements (existing tabs); fullscreen icon (existing); "Add image" solid pill.
- Pinterest masonry: 4 balanced columns desktop (2 mobile), 16px radius tiles, natural heights. Tile meta: bottom-left 9px uppercase (kind · date) or serif element name + progress hairline. Hover: heavier scrim + glass icon buttons (open_in_full → existing lightbox portal, more_horiz → actions). Dashed "Add pin" tile at first column break.

## Elements / closet — `web/src/app/elements/page.tsx` · ref 6d
- Studio wall + "The closet" header + category glass chips (All/Garments/Wigs/Props/Materials from nodeType/category).
- 5-col (2-col mobile) 3:4 photo tiles: top-left on-glass status chip, bottom scrim with kind·build meta + serif name. Dashed "New element" tile last.

## Events — `web/src/app/conventions/page.tsx` · ref 6e
- Backdrop: next convention's photo. Left: "Next · dates · city" eyebrow, event name 84px, meta triplet (Countdown / Builds / Packing hairline), pills "Day plans" (solid) + "Packing list" (glass).
- Right glass panel "The season · YYYY": event rows (serif name, date, meta line, day-plan chips for the next one), de-emphasized by recency; footer "Add an event".

## Event detail — `web/src/app/conventions/[id]/page.tsx` · ref 8a
- Backdrop: convention/venue photo. Left: dates+city eyebrow, event name 72px, meta triplet (Countdown / Builds / Status — "LOGISTICS PENDING" uppercase warn), logistics checklist lines (hotel, badges) with underline "Fix" actions.
- Bottom-left day-plan rail: one photo tile per `groupConventionDays` day (eyebrow "Day N · date", serif build name, plan/warning meta); unplanned days = dashed "Assign a build" tile.
- Right glass panel: packing list (existing `PackingItemRow` logic) grouped by build, square light checkboxes (ChecklistRow style, **sentence-case 13px labels** — QA-4 — strike-through + 55% when packed, mono PK codes), header progress hairline, footer "Add packing item…" composer. Edit affordance in bar (icon), "Plan a day" solid pill.

## Element detail — `web/src/components/builds/explorer/BuildNodeDetailSheet.tsx` · ref 8b
- The ONE sanctioned second-layer overlay: the existing inspector restyled onto heavier glass (bg 0.14, blur 30px, border 0.22, deep shadow) over the dimmed (40%) explorer panel. Desktop: right sheet, explorer width; mobile: keep the existing floating bottom sheet with half/full drag states and Escape/backdrop close. `inline` mode maps to rendering inside the work panel.
- Keep the component's real anatomy 1:1: autosave `persistStatus` label in header (Saved / Unsaved / Saving… / Save failed, aria-live) + close; inline-EDITABLE serif name with light bottom border (required-name validation → `--on-glass-danger` border + message); meta row = `formatNodeTypeLabel` · status tone dot (STATUS_DOT, on-glass colors) · progress %; **Status segmented control** (`ELEMENT_COMBINED_OPTIONS` / `MATERIAL_STATUS_OPTIONS` by nodeType — active segment = solid light w/ ink text, track = light-8% pill); Direct cost input (glass outline field, tabular) + read-only Rollup cost (`formatCents(totalCostCents)`); Notes textarea (glass outline).
- Actions: "New child" (solid pill), "Move" (`onMoveNode`, outline), "Unlink root|child" (outline in on-glass danger tint); "Open full page" link → `/elements/[id]`.
- Deliberate v2 addition (flag to owner): element photo enlarged to 150×190 (was 56px thumb) since imagery leads the language. No other fields added or removed.

## Public build — `web/src/components/builds/PublicBuildDetailView.tsx` · ref 8c
- Viewer mode: NO edit chrome, no add pill. Bar carries "Public build" eyebrow + creator identity (avatar, @handle, builds/followers meta) + solid "Follow" pill (existing follow mutation + `followPending` state).
- Headline block: character/source/status eyebrow, name 72px, progress hairline (from tasksChecked/tasksTotal). Social actions as glass outline pills: favorite+count, chat_bubble+count, share (existing like/unlike + comment mutations).
- Right glass panel tabs = `togglesResolved` visibility (showExplorer/showTasks/showVisualBoard/showSummary) — render only owner-enabled tabs, same fallback-to-first logic. Board tab = 3-col mini masonry; Comments section below (avatar, @handle + Creator chip, 13px body) with underline "Add a comment…" composer + Post.
- Offline: this surface is online-only — `OnlineOnlyBanner` strip renders in the panel header per 03. Share-link mode identical minus follow (signed-out CTA instead).

## Cross-cutting
- SyncStatus glass chip bottom-left on all studio screens; PendingBadge on rows written offline; OnlineOnlyBanner strip in panel headers for social surfaces.

## Settings — `web/src/app/settings/page.tsx` (+ `/account`, `/subscription`, `/notifications`, `/data`) · ref 11a
- Settings speaks the glass language too — same work-panel treatment as build detail (ref 6b), NOT cream. Glass top bar over `--studio-wall`; the settings body is ONE glass work panel (bg 0.10, blur 24px, border 0.16, radius 14px), centered (max ~600px), light-on-glass throughout.
- Keep the real anatomy 1:1: header (eyebrow "System preferences" + serif "Settings"), **Backup & storage** (storage `formatStorageMb(used/limit)` line + `UpgradePrompt` as the glass panel-header strip when `!canUseCloudSync`), **Profile & identity** (Appearance system/light/dark segmented via `ThemeContext`, Language `SUPPORTED_LOCALES` segmented, then the `menuItems` list → account/subscription/notifications/data with chevrons), **Legal & policies** (Terms/Privacy/Security), danger **Sign out** (keeps `SignOutConfirmDialog`, REQ-031 export warning for free users).
- Glass tokens: dividers `--glass-divider`, meta labels at 55–60% light, segmented **active = solid light (#fffdf8) + ink text**, inactive = glass outline (border light-30%, text light-60%). Links (View plan, legal) render as underlined light meta — the on-photo tertiary style — not indigo (indigo has too little contrast on dark glass). Sign out = `--on-glass-danger` text + light-danger outline. `PageHeader` back affordance moves into the glass bar.
- `SectionCard` is retired here — it does not survive as a cream component (supersedes the earlier note in 03). Sub-pages use the same glass-panel shell; `/subscription` renders the `SUBSCRIPTION_PLANS` grid as glass plan cards (current tier = light-outline), tiers identical to the landing pricing section.
- Mobile: the glass panel goes full-width with the glass bar above and glass tab bar below.

## Auth — `web/src/app/auth/{signin,signup,verify-email,reset-password}/page.tsx` · ref 11b
- Glass language, not cream. Full-bleed dark cosplay photo + `--scrim-page-vertical`, centered **heavier-glass** auth card (bg 0.14, blur 30px, border 0.22, deep shadow — the element-detail-sheet weight, chosen so form fields keep AA contrast over the scrim).
- Keep the anatomy 1:1: "Welcome to" eyebrow + serif italic "Kyarafit"; Google + Apple OAuth = **glass-outline pills** (light-40% border, light text); "or" divider (light-18% rules); username OR email + password as **glass-outline fields** (border light-30%, bg light-6%, radius 10px, placeholder at 55%; keep the `signInWithEmail` toggle); **solid-light "Sign in"** pill with ink text (primary); "Forgot password?" / "Create one" as underlined light meta; resend-verification block same treatment.
- Alerts: error/info banners become on-glass tints (danger = `--on-glass-danger` bg/border + light text; success = `--on-glass-chip-done-*`) instead of the red-50/green-50 cream boxes. `/signup`, `/verify-email`, `/reset-password` reuse the same photo-backdrop + glass-card frame.

## Social — Feed `web/src/app/feed/page.tsx` · ref 12a · Discover `discover/page.tsx` · ref 12b · Groups `groups/page.tsx` · ref 12c
- All three are online-only studio surfaces: glass top bar (Feed/Discover/Groups inline nav, active = light + underline) over the photo/studio wall; `OnlineOnlyBanner` renders as a compact glass strip in the shelf header (icon + "Online-only · Retry"), NOT the cream banner.
- **Feed** · ref 12a leads dramatically like builds/events: the single latest build from a followed creator fills the page as a full-bleed photo backdrop (scrims), with owner chip + "Latest from people you follow" eyebrow + source meta + serif build name (80px) + social actions (favorite/comment glass-outline pills + "View build" solid pill) lower-left. The rest of the feed is a bottom glass shelf "The feed · N" of 170px poster tiles (@owner · ♡count meta + serif name). `PublicBuildCard` still backs the shelf tiles + the Discover grid.
- **Discover** · ref 12b keeps the calmer 3-col `PublicBuildCard` grid (4:5 photo tiles, top scrim, owner chip when `showOwner`, source/name + like/comment counts) on the studio wall — browsing many, not featuring one. Empty/loading via `EmptyState surface="glass"`.
- **Groups** · ref 12c mirrors the feed's drama: the most-active group's photo fills the page, name (80px) + overlapping member-avatar row + "5 members · 3 builds" + "Open group" solid pill lower-left; "Your groups · N" bottom glass shelf of 150px tiles (visibility · members meta + serif `group.name`, featured = light inset ring) ending in a dashed "Create group" tile. "Create group" also sits as a solid pill in the bar; both fire `openCreationModal("newGroup")`. Missing-image fallback = `group` icon on `--studio-wall`.
- Group detail `g/[groupId]` · ref 12d = event-detail (8a) grammar: group photo backdrop, identity + overlapping member-avatar row lower-left, convention day-rail bottom-left (convention name serif + date chips, dashed "Link a convention" tile), and ONE glass work panel for "Builds in this group · N" (build rows = 52×66 thumb + character/@owner eyebrow + serif name + chevron; own builds get a remove `close`; footer "Add my build" composer). Convention day-picker + build-picker modals become heavier-glass dialogs (per AdaptiveModal in 03). Keep every mutation (`setDays`, `setGroupId`) and `isAdmin` gate.
- Keep every query/gate as-is (`listFeedFromFollowing`, `listDiscover`, `groups.listForUser`, `useCurrentUser`); only presentation changes. Feed/Groups pick the featured item as the most-recent from the same query that fills the shelf.
- Keep every query/gate as-is (`listFeedFromFollowing`, `listDiscover`, `groups.listForUser`, `useCurrentUser`); only presentation changes.
- Missing photo fallback: `--studio-wall` + oversized 10% opacity Material Symbol of the section — never a gray box.
- i18n: all strings through existing next-intl keys; add new keys for helper copy (drag hints, composer placeholders) in en/ja/es.

## The last mile — states & flows · ref 13a–g
- **Auth variants** (`auth/signup`, `auth/verify-email/inbox`, `auth/reset-password`) · ref 13a/13b/13c: signup uses the same split-screen frame as signin (13a) with name/username/email/password glass-outline fields + OAuth pills; verify-inbox (13b) and reset (13c) are single centered heavier-glass cards on a photo — `mark_email_unread` glyph + "Check your inbox" + resend meta / email field + "Send reset link". Keep all existing `authClient` calls, validation, and error/info banners (as on-glass tints per the auth note in 03).
- **Creation modal** (`AdaptiveModal` — new build/element/convention/group) · ref 13d: heavier-glass dialog (bg 0.14, blur 30px) centered over the dimmed+blurred studio; dashed cover-image drop slot, glass-outline name + character fields, status segmented control (active = solid light/ink), footer = outline "Cancel" + solid-light "Create". Same for element/convention/group with their fields.
- **Mobile menu drawer** (`MobileNavMenu`) · ref 13e: right-side glass sheet (bg 0.12, blur 30px, left hairline, deep shadow) over the dimmed screen; full `NAV_SECTIONS_PRIMARY` list (active row = light + light-8% wash, inactive 70%), divider, Settings, and `SidebarUserProfile` footer (avatar + name + tier). Keep `getActiveSection` highlighting.
- **First-run empty** · ref 13f: `EmptyState surface="glass"` centered on `--studio-wall` — 10%-light section glyph, "Your studio is empty" eyebrow, serif invitation headline, one solid "Start your first build" pill (fires the creation modal). Same pattern per section (closet/events empties swap glyph + copy).
- **No-imagery fallback** · ref 13g: when a build/element/event has no cover, the photo layer becomes the `--studio-wall` gradient and a monogram plate (first initial, serif, 25% light, on a faint diagonal-stripe field) stands in on the left with a dashed "Add a cover" affordance; the glass panel and all identity/meta render unchanged. This is the canonical realization of the "missing photo fallback" rule above — never a gray box.
