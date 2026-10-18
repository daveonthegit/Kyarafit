# Kyarafit — Domain Context

Ubiquitous language for cosplay wardrobe and convention planning. Use these terms in code,
tests, issues, and docs. Implementation status and legacy persistence names belong in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); accepted future work is listed in
[`docs/ROADMAP.md`](docs/ROADMAP.md). A defined term does not imply a shipped feature.

## Wardrobe and planning

**Build**: A user's cosplay project for a character; the central collection of elements, progress,
and planning work.

**Element**: A build-scoped costume component, optionally nested beneath another element.
_Avoid_: Closet item, node (except when discussing legacy storage or migration).

**Closet item**: A historical standalone wardrobe-inventory concept, superseded by build-scoped
elements. Not a separate current product page.

**Convention**: An event a user plans to attend, with day-by-day builds and a packing list.

**Progress update**: A dated entry in a build's progress timeline, optionally with images and a
progress percentage. Publishing is an explicit action distinct from keeping a private entry.

**Workflow item / task**: A to-do or workflow step associated with a build.

**Build tab**: A local list view: all, current, planning, completed, or archived. These are views,
not additional build lifecycle states.

## Subscription and media

**Tier**: A user's subscription level. The accepted product direction is free or supporter;
legacy Pro is a paid level to normalize into supporter, not a new entitlement set.

**Supporter**: The paid subscription level, with the same entitlements across its price points.

**Entitlement / feature**: A capability permitted by a subscription level and enforced by the
server when a hosted action requires it.

**Hosted media**: Media Kyarafit stores and serves, including published/shared images and
managed-sync personal media. Distinct from personal media kept locally or in user-owned storage.

**Hosted-media cap**: The per-user byte allowance for hosted media. Exceeding it blocks new uploads,
not deletion of existing media; the accepted allowances are not evidence of current enforcement.

## Sync — accepted terminology

**Managed sync**: Personal-data sync through Kyarafit's backend, distinct from online social actions.

**BYO sync**: Personal-data sync through storage the user owns (Google Drive first), rather than
personal snapshots stored on Kyarafit's servers. An accepted direction, not a currently available
Drive integration.

**Sync method**: The accepted mutually exclusive choice of authoritative remote: Off, Google Drive,
or Kyarafit Cloud. This choice must not be confused with today's managed-sync status readout.
