# Backend authorization (Convex)

The one rule: **a public Convex function derives the acting user from the session, never
from an argument.**

```ts
import { optionalIdentity, requireIdentity } from "./lib/authz";

// Mutations: no session is an error.
const actorId = await requireIdentity(ctx); // throws "Unauthorized"

// Queries: no session means no data, not a crash.
const actorId = await optionalIdentity(ctx); // string | null
if (!actorId) return [];
```

`ctx.auth.getUserIdentity().subject` is the user's `externalId` — the same value stored on
`users.externalId` and used as `userId` / `ownerId` on every owned table.

## Why the `userId` arguments are still there

They are inert. Every public function used to take the acting user's id as a plain string
argument and compare _that_ against the resource owner, which meant passing a victim's id
authorized you as them. Removing the arguments would have been correct but breaking:
Convex validates arguments strictly, so a deployed client that still sends `userId` fails
with an argument-validation error, and installed mobile builds cannot be force-updated.

So the migration is two-phase:

- **Phase A (done — this is the security fix).** Actor arguments stay in the validator as
  `v.optional(v.string())` and their values are ignored. Old clients keep sending them and
  keep working; new clients stop sending them. The hole closes on deploy, with no client
  release required.
- **Phase B (not done — cosmetic).** Once web and mobile have both shipped without the
  arguments, delete them from the validators. Nothing depends on this; it is cleanup.

Grep for `retained for deployed clients but ignored` to find the Phase B removal sites.

## Arguments that are _not_ actor arguments

An argument naming a **different** user is real input and stays required:

| Function                            | Argument       | Names                               |
| ----------------------------------- | -------------- | ----------------------------------- |
| `buildCollaborators.set` / `remove` | `userId`       | the collaborator                    |
| `buildCollaborators.addByEmail`     | `email`        | the invitee                         |
| `groups.addMember`                  | `newUserId`    | the new member                      |
| `groups.removeMember`               | `removeUserId` | the member being removed            |
| `groups.setMemberRole`              | `targetUserId` | the member being promoted           |
| `follows.follow` / `unfollow`       | `followingId`  | the follow target                   |
| `builds.listPublicByUser`           | `userId`       | the profile owner (public endpoint) |

The actor names to derive are `userId`, `ownerId`, `externalId`, `followerId`.

## Endpoints that are public by design

These serve signed-out visitors and must stay that way. Do not "fix" them:

- `builds.listDiscover` — the public feed. Deliberately exposes each build's `userId`,
  which the public profile page needs.
- `builds.listPublicByUser` — `visibility === "public"` only, share/sync secrets stripped.
- `users.getByUsername` — `profileVisibility === "public"` only.
- `builds.getByShareToken` and `builds.getPublicViewerBundle` — the share token is the
  bearer credential.
- `files.getUrl` — see below.
- The build-scoped read siblings (`builds.getNodes`, `buildTasks.listByBuild`,
  `buildComments.listByBuild`, `buildLikes.countByBuild`,
  `buildReferenceImages.listByBuild`, `buildProcessPictures.listByBuild`,
  `workflow.listBuildTree`, `cosplayNodes.listBuildVisualNodes`) all gate on
  `canReadBuildWorkflowData` (`lib/buildPublicViewer.ts`), which is the single predicate
  for "may this viewer read this build" — owner, collaborator, `public`, or `unlisted`
  with a matching share token. Use it rather than writing a new rule.

## Media

Storage ids are not a security boundary: they are returned on build, element, convention,
reference-image, process-picture, group and user rows. `files.getUrl` therefore resolves
the id back to the row that references it and applies that row's visibility — see
`lib/mediaAccess.ts`. The `by_imageStorageId` indexes exist for that lookup.

Two deliberate looseness points, both documented in that file:

1. A blob that **no row references** is readable by any authenticated caller. The
   create-with-image modals upload first and preview via `getUrl` before the owning row
   exists, so a strict deny would break them.
2. `unlisted` counts as public for media, because `getPublicViewerBundle` serves unlisted
   builds to anonymous share-link holders who then resolve each image through `getUrl`
   without a token.

Narrowing either needs an owner-indexed media table, which is part of an open decision
about the media access model. Do not change the model here without that decision.

## Tests

`convex/authz.test.ts`, run with `npm run test:convex`. It asserts the two properties that
matter — a caller passing someone else's id cannot act as them, and an unauthenticated
caller is rejected — for a representative function in every module, plus a group pinning
down what must stay public. Add to it when you add a public function.
