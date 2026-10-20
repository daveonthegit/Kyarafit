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

**Local vault**: The per-account SQLite database (plus its photo directory) on a device that is the
authoritative home of that account's personal planning data, online or offline, free or paid.
Sign-out locks it; only an explicit "remove from this device" or account deletion deletes it.

**Managed sync**: Personal-data sync through Kyarafit's backend, distinct from online social actions.

**Row replica**: Managed sync's cloud copy of a vault: one opaque document per vault row, keyed
by the row's own id and ordered by a per-account revision. It is the paid account's authoritative
cloud copy of personal data.

**Published copy**: The server copy of a build or convention that its owner explicitly published
for a social feature (collaborators, groups). A projection of the vault row, never edited back into
it. _Avoid_: cloud mirror (for these rows).

**Changes that didn't apply**: The losing side of a managed-sync conflict (an overwritten value, an
edit to something deleted elsewhere), kept so the user can restore it as a new edit.

**Recovered build**: The build managed sync moves content into when another device deleted the
build it belonged to.

**BYO sync**: Personal-data sync through storage the user owns (Google Drive first), rather than
personal snapshots stored on Kyarafit's servers. An accepted direction, not a currently available
Drive integration.

**Sync method**: The accepted mutually exclusive choice of authoritative remote: Off, Google Drive,
or Kyarafit Cloud. This choice must not be confused with today's managed-sync status readout.
