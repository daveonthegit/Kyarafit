# Account export scope

The JSON archive preserves raw owned records, including system identities and stored fields,
through `buildDataBundle` / `parseDataBundle`. Collection names match Convex tables. Older
archives remain readable; absent collections become empty arrays. Export is not a full restore
implementation, and it does not recreate sharing credentials or server operational state.

## Schema inventory

| Ownership | Included tables |
| --- | --- |
| `userId` (session subject) | `builds`, `cosplayNodes`, `conventions`, `conventionDayPlans`, `packingListItems`, `buildTasks`, `workflowItems`, `workflowAttachments`, `workflowDependencies`, `workflowTemplates`, `buildReferenceImages`, `buildProcessPictures`, `buildProgressUpdates` |
| Legacy `userId`, retained even if no current reader uses them | `closetItems`, `cosplayNodeLinks`, `buildCosplayLinks`, `buildNodeStates`, `buildItemLinks` |
| Profile `externalId` | `users` |
| `createdBy` (session subject), with current membership required | `groups` |
| Owned template / creator-owned group with current membership | `workflowTemplateItems`, `groupConventionDays` |
| Own membership, collaboration, authored social rows | `groupMembers`, `buildCollaborators`, `buildLikes`, `buildComments`, `activities` via `userId`; `follows` via `followerId` |
| Internal user ID resolved from session subject | `userPushPreferences` via `userId`; `broadcasts` via `createdBy` |
| Retained cloud-sync content via `userId` | `replicaRows`, `replicaConflicts`, `replicaAssets` |

Workflow groups and tasks are exported without requiring a build, convention, or attachment.
Attachments and dependencies also have their own collections, preserving all fields independently
of whether their target still exists. Progress updates retain notes and every `imageRefs` entry;
reference and process pictures retain their URL/storage references and ordering. Local-only rows
are merged by collection and identity, with the server row winning for a shared identity.

## Deliberate exclusions

These schema tables are service state, not portable user-authored records:

- `accountDeletionState`, `accountDeletionJobs`, `accountDeletionAssets`: privacy-cleanup worklists.
- `ledgerValidationState`, `idempotencyLedger`: server replay proofs and validation cursors.
- `storageUploadReservations`, `storageClaims`: upload capabilities, quota reservations, and blob
  ownership bookkeeping. Replaying these would not upload or authorize a blob on another service.
- `storageReferenceEpochs`, `progressMediaReferences`: derived reference indexes.
- `replicaLinks`, `replicaHeads`, `replicaOps`: derived links, stream cursors, and operation dedupe.

Build `shareToken`, user Stripe customer/subscription IDs, and Expo push tokens are excluded;
these are live credentials or service-specific identifiers, not portable content.

Storage blobs and authentication-provider accounts are outside `convex/schema.ts` and are not
included. Photo references are metadata, not photo files: this JSON archive alone is not a durable
photo backup. English and Spanish export copy explicitly list included content and exclusions
rather than claiming to include everything in an account.
