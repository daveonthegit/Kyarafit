# AGENT_PROMPT_POLISH — screen-by-screen polish of the web Glass Studio implementation

Operating prompt for an **interactive** polish session over the web app. Phases 0–6 landed the
Glass Studio language across every routed screen (branch `feat/glass-studio-phase-0`, commits
`f170bec…d9128f7` plus owner follow-ups); this session walks the screens **one at a time, with the
owner in the loop**, and closes the gap between "implemented per spec" and "matches the prototype
to the pixel and feels finished."

---

## PROMPT (copy from here)

You are polishing the web implementation of the Kyarafit v2 "Glass Studio" redesign, one screen at
a time, interactively. The owner drives: they name a screen (or say "next"), you polish exactly
that screen, show them what changed, and wait. Small diffs, one commit per screen, no PRs.

### Session setup (once, before the first screen)

1. Read `docs/redesign/05-qa-addendum.md` (the lint rules — they win over everything),
   `docs/redesign/02-surface-rules.md` (the 16 laws), and skim `docs/redesign/01-foundations.md`.
2. Start the dev server (`npm run dev:web`) and drive it with a browser/Playwright so every change
   is **verified visually**, not just by typecheck. Screenshot at **1280×820** (desktop) and
   **390×844** (mobile web) — the prototype's exact stage sizes — for before/after comparison.
3. Note the current state of `git log` — the owner has follow-up commits beyond the phase work;
   the working tree is the truth, not phase summaries.

### Per-screen loop

For the screen the owner names:

1. **Load the reference.** Find the screen's spec in `docs/redesign/04-screens.md` (its ref id,
   e.g. Home = 6a) and extract its prototype block from
   `docs/redesign/reference/Kyarafit Prototype.dc.html` — both `data-plat="desktop"` and
   `data-plat="mobile"` variants; last-mile states (13a–13g) live in
   `docs/redesign/reference/Kyarafit Redesign.dc.html`. The prototype markup is the pixel source
   of truth: lift exact font sizes, tracking, paddings, opacities, gaps, radii, and widths from
   its inline styles. Quick extraction:
   `python3 -c 'h=open("docs/redesign/reference/Kyarafit Prototype.dc.html").read(); i=h.find("data-screen=\"home\" data-plat=\"desktop\""); print(h[i:i+5000])'`
2. **Load the implementation.** Read the page and every component it renders (shelves, panels,
   rows, modals it opens).
3. **Screenshot the current state** at both sizes, including hover/selected/empty/loading states
   where reachable (seed or mock as needed — never commit seed changes).
4. **Compare and fix**, in this priority order:
   - **QA violations (blocking):** text <9px; uppercase tracking <0.14em; more than one
     solid-`#fffdf8` primary in view (segmented actives exempt); translucent light used as a
     primary fill (`0.92`); dashed borders on non-add elements; mixed glass weights on one element
     (only 0.08/18 · 0.10/24 · 0.14/30 exist); uppercase list content (tasks/packing/element
     names are sentence-case 13px); tap targets <44px; emoji.
   - **Surface-rule violations:** more than one glass panel per screen region; glass nested in
     glass; text or glass on raw photo without the scrim; missing `-strong` scrim when a right
     work panel sits on the photo or the photo is high-key; cream leaking into the product;
     accent used as a fill or status color (links/focus only).
   - **Pixel drift vs the prototype:** headline sizes/line-height/tracking, eyebrow tiers
     (9px/0.14–0.16 · 10px/0.16–0.24 · 10px/0.26–0.3), panel paddings and divider weights, tile
     dimensions, meta opacities (55/70/75/85), serif-vs-sans usage (serif only for entity names
     inside panels).
   - **Feel:** spacing rhythm and alignment, truncation with long names (test with a long build/
     event name), hover and focus-visible states on every interactive element, panel-entrance and
     Ken-Burns motion (and their reduced-motion behavior), scroll/overflow behavior inside
     panels, responsive collapse between 390 and 1280, empty/loading/error states per
     DESIGN_SYSTEM §4, dark-photo AA contrast (raise the local scrim, never glass opacity
     past 0.14).
5. **Verify:** re-screenshot both sizes, run `npm run typecheck:web`, `npm run lint:web`,
   `npm run test`, and `npm run i18n:check` (new strings → en + es on web).
6. **Report to the owner:** one short summary — what was off, what changed, before/after
   screenshots — then **stop and wait** for approval or tweak requests before committing
   `polish(web): <screen> — <what>` and moving on.

### Hard rules

- **Presentation only.** No query, mutation, gating, drag-stack, or navigation changes. If a fix
  seems to require logic changes, flag it and wait.
- Tokens only — no new hardcoded glass values; if a needed value has no token, propose adding it
  to `design_tokens.json`/`globals.css` first.
- Screens the QA pass marked **already perfect** (Planner, Elements/closet, Discover, element
  detail sheet, Sign-in, drawer 13e, first-run empty 13f, no-imagery fallback 13g): match the
  spec exactly — polish drift _toward_ the spec is fine, "improvements" beyond it are not.
- Where the spec and the real data model conflict, the implementation's existing compromise
  stands unless the owner says otherwise (e.g. composed headline statements, packing meta).
- Never rewrite a file wholesale during polish — targeted edits keep the owner's follow-up work
  intact.

### Suggested walk order (owner may reorder or skip)

| #   | Screen                                                                                                  | Route                            | Ref                                                               |
| --- | ------------------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------- |
| 1   | Home                                                                                                    | `/home`                          | 6a / 7a                                                           |
| 2   | Builds overview                                                                                         | `/builds`                        | 1b / 7b                                                           |
| 3   | Build detail (+ Elements/Tasks/Board/Updates/Summary tabs, element sheet)                               | `/build-detail/[id]`             | 6b, 4a, 4b, 6c, 8b                                                |
| 4   | Planner (daily / events / calendar)                                                                     | `/planner`                       | 3b / 7e                                                           |
| 5   | Elements / closet                                                                                       | `/elements`                      | 6d                                                                |
| 6   | Element full page                                                                                       | `/elements/[id]`                 | (shares 4a/8b grammar — never got its own pass; expect more work) |
| 7   | Events overview                                                                                         | `/conventions`                   | 6e                                                                |
| 8   | Event detail + packing                                                                                  | `/conventions/[id]`, `…/packing` | 8a                                                                |
| 9   | Feed / Discover / Groups                                                                                | `/feed`, `/discover`, `/groups`  | 12a–12c                                                           |
| 10  | Group detail                                                                                            | `/g/[groupId]`                   | 12d                                                               |
| 11  | Public build + share link                                                                               | `/b/[buildId]`, `/b/s/[token]`   | 8c                                                                |
| 12  | Settings + all sub-pages                                                                                | `/settings/…`                    | 11a                                                               |
| 13  | Auth (sign-in/up, verify, reset)                                                                        | `/auth/…`                        | 11b, 13a–13c                                                      |
| 14  | Terms / Privacy                                                                                         | `/terms`, `/privacy`             | 11c                                                               |
| 15  | Landing (full scroll pass, both motion modes)                                                           | `/`                              | Landing Live                                                      |
| 16  | Shell sweep: top bar, tab bar, drawer, FAB, creation modals, SyncStatus/OnlineOnlyBanner across screens | —                                | 13d/13e + 03                                                      |

Known debt to keep an eye out for (from the implementation notes): the planner's
`FullScreenCalendar` is still cream inside its glass panel; the creation modals ride `Sheet`
rather than the 13d dialog; `/elements/[id]` only inherited component-level restyles; the
transitional `bg-glass-*-on-wall` underlays on chrome can drop back to plain glass on any screen
that now renders its own full-bleed backdrop.

Start by asking the owner which screen to begin with (or propose #1).

## (end of prompt)
