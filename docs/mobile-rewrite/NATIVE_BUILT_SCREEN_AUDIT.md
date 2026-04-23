# Native Built Screen Audit

Last updated: 2026-04-22 (post planner/settings/social/public-viewer pass: dark-mode plumbing tightened, shared mobile fonts applied, collapsible filters + FAB menus landed, build detail moved to summary-first explorer flow, planner now has grouped workflow plus structure controls and inline dependency previews, build explorer now supports in-context create actions plus richer in-sheet child actions/drill-in, account now has native profile-photo picking/crop plus username availability feedback, public build cards now support likes and comments, Discover/Feed/Profile now open a dedicated native public-build detail viewer modeled on the web public page instead of the private editor route, settings account/subscription/notifications are native, and More now routes into native Groups / Feed / Discover / Profile stacks instead of browser fallbacks)

This audit is intentionally scoped to the native screens that already exist in `mobile/`. Per current product direction, these built screens are being corrected before new placeholder or missing routes are expanded.

## Summary

| Native screen                   | Web mobile baseline                               | Parity  | UX quality | Main issues                                                                                                                                                                     |
| ------------------------------- | ------------------------------------------------- | ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `(tabs)/index`                  | `/home`                                           | Partial | Good       | Hero and next steps are much stronger now; remaining gaps are final polish and any additional quick-glance density tuning                                                       |
| `(tabs)/builds`                 | `/builds`                                         | Partial | Good       | Remaining gap is deeper create-flow parity and downstream build management flows                                                                                                |
| `(tabs)/elements`               | `/elements`                                       | Partial | Good       | List/detail are much stronger now; remaining gaps are richer bulk/tree management and explorer-like structural tooling                                                          |
| `(tabs)/planner`                | `/planner`                                        | Partial | Good       | Grouping, editing, templates, structure controls, and blocker previews now exist; remaining gaps are denser dependency visualization and drag-grade tooling                     |
| `(app)/b/[buildId]`             | `/b/[buildId]`                                    | Partial | Acceptable | Summary-first owner/editor flow is much stronger; remaining work is broader explorer/tool parity, but this route should no longer be used for public social taps                |
| `(app)/public-builds/[buildId]` | web public build viewer (`PublicBuildDetailView`) | Partial | Good       | Dedicated native public viewer now exists for Discover / Feed / public profile taps; remaining gaps are the no-auth share route and any deeper public element drill-in behavior |
| `(tabs)/more`                   | `MobileNavMenu` + overflow destinations           | Exact   | Good       | Overflow destinations now route natively; remaining work is mostly polish rather than missing navigation coverage                                                               |
| `(app)/settings/index`          | `/settings`                                       | Partial | Good       | Native account/subscription/notifications now exist, with better account identity UX; remaining gaps are deeper billing/privacy/push-preference parity                          |
| `(auth)/*`                      | `/auth/*`                                         | Partial | Good       | Generally aligned, but sign-up and verify/reset states are less polished than sign-in                                                                                           |

## Screen findings

### Home

- Parity: `partial`
- UX quality: `good`
- Required changes:
  - Keep the refreshed focused-build hierarchy aligned with web mobile as the web homepage evolves.
  - Continue refining quick-glance density so more context fits above the fold without losing readability.
  - Preserve actionable next-step rows instead of drifting back toward passive text lists.
  - Fold settings/menu access into the screen/header flow more intentionally.
- Mobile-specific improvements:
  - Keep the hero and primary CTA reachable with one hand.
  - Preserve horizontal rails for quick browsing instead of forcing dense vertical lists.

### Builds

- Parity: `partial`
- UX quality: `acceptable`
- Required changes:
  - Preserve the new collapsible filter pattern and FAB menu as the mobile baseline.
  - Continue aligning create flows and deeper build actions with the current web mobile behavior.
- Mobile-specific improvements:
  - Keep long-press quick actions.
  - Favor bigger poster-style tap targets over dense text rows.

### Elements

- Parity: `partial`
- UX quality: `acceptable`
- Required changes:
  - Keep the new collapsible filter treatment and FAB menu.
  - Extend the refreshed detail/edit routes into richer tree management and explorer-style structure editing.
- Mobile-specific improvements:
  - Treat filters as lightweight chips rather than three equally heavy control rows.
  - Improve row scanability for touch-first browsing.

### Planner

- Parity: `partial`
- UX quality: `good`
- Required changes:
  - Keep the grouped task tree aligned with web planner behavior, including `Elements and other tasks`.
  - Build on the new shared edit/template tooling plus blocker previews with more graphical dependency visibility and more fluid drag-grade structure controls.
- Mobile-specific improvements:
  - Preserve the current quick-add task path so planner stays useful without forcing users into another screen first.
  - Keep agenda and event views lighter-weight than web calendar chrome for faster handheld scanning.

### Build detail

- Parity: `partial`
- UX quality: `poor`
- Required changes:
  - Keep summary as the first stop and avoid reintroducing the full-page hero on non-summary tabs.
  - Continue extending the mobile explorer toward the full web action set now that open-detail/delete/template hooks, in-explorer create actions, and in-sheet child drill-in/actions exist.
  - Finish dark-mode cleanup in the remaining detail-adjacent sheets/routes.
- Mobile-specific improvements:
  - Preserve the four-tab model, but reduce dead space and make common actions easier to reach.
  - Keep image/reference/process surfaces thumb-friendly.

### More

- Parity: `exact`
- UX quality: `good`
- Required changes:
  - Keep matching the product’s current nav language as web mobile evolves.
- Mobile-specific improvements:
  - Keep it feeling like a native overflow hub rather than a catch-all links page.

### Settings

- Parity: `partial`
- UX quality: `acceptable`
- Required changes:
  - Build on the new native account/subscription/notifications routes instead of regressing to web bridges.
  - Keep storage/tier and appearance controls aligned with the shared product language.
  - Preserve the new profile-photo and username-availability UX as the baseline rather than letting account flows drift back to generic forms.
- Mobile-specific improvements:
  - Keep the highest-frequency controls near the top.
  - Use larger, grouped settings rows instead of isolated boxes.

### Social surfaces

- Parity: `partial`
- UX quality: `good`
- Required changes:
  - Keep likes and comments on public build cards aligned with the current web social language.
  - Build on the new dedicated native public-build viewer instead of regressing public taps back into the private editor route.
  - Add the remaining collaborator-invite flow and the no-auth share-token viewer parity.
- Mobile-specific improvements:
  - Keep quick engagement actions close to the card edge so they are easy to hit one-handed.
  - Prefer native discussion flows over bouncing out to browser-based social UI.

### Auth

- Parity: `partial`
- UX quality: `good`
- Required changes:
  - Keep the current sign-in direction as the reference.
  - Bring sign-up and verification/reset states closer to the same editorial structure and spacing quality.
- Mobile-specific improvements:
  - Preserve keyboard-friendly form flow and simple primary actions.

## Shared issues across built screens

- Existing native screens often have correct data contracts but weaker hierarchy than the web mobile product.
- The biggest remaining built-screen gaps have shifted from raw styling drift to deeper parity features and missing subflows.
- Several screens still expose controls before establishing screen purpose, which hurts scanability on handheld devices.

## Implementation order for built screens

1. Planner dependency / structure polish
2. Build detail explorer/tooling parity
3. Home hierarchy polish
4. Auth consistency pass

Missing/placeholder screens are intentionally deferred until this built-screen pass is in place.
