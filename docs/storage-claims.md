# Current Convex storage contract

This is the containment contract for current `_storage` uploads, not the future R2 pipeline.
[ADR-0001](adr/0001-public-capability-urls-for-hosted-media.md) remains the target for hosted bytes:
discovery and attachment are authorized; possession of a capability URL serves bytes without a
sign-in or a per-view signed URL. Published/shared URLs are link-accessible.

## Upload and preview

`files.generateUploadUrl({})` requires a session and an existing app user. Its return
value remains a URL string. Existing clients POST their binary to that URL and receive
`{ storageId }`; no client release is required to change the ingress path.

The URL is a one-time upload capability, not a serving URL. Never log or persist it in user records.
`POST /media/upload` consumes it before reading the body, bounds the streamed bytes, stores the
blob, verifies storage metadata, and records its uploader and actual size. OPTIONS permits
cookie-free browser uploads. `CONVEX_SITE_URL` must identify the deployment's HTTP endpoint.

- Unused reservations expire after 15 minutes and reserve quota atomically. Interrupted consumed
  reservations retain their quota until bounded recovery has reconciled stored bytes.
- Up to five pending reservations/uploads per user are allowed.
- The ingress safety ceiling is 20 MiB to bound proxy buffering and pending bytes, independent of
  tier allowances and the future R2 derivative policy.
- The original zero-argument mutation reserves the smaller of the ingress ceiling and available
  quota. Updated callers can opt into `files.generateUploadUrlForSize({ sizeBytes })` to reserve
  their exact compressed byte size and allow concurrent small uploads. The original SDK call
  signature is unchanged. The conservative legacy reservation can serialize uploads near the cap;
  a completed POST releases unused reserved bytes before the next mint.
- Unattached uploads expire after 24 hours. Their actual bytes count toward usage immediately.
- Pending preview discovery requires the uploader's session and an unexpired claim.
- Upload rejection deletes any stored blob and releases the reservation. Scheduled cleanup deletes
  abandoned claimed blobs, refunds their verified size, and is safe to retry. A non-secret MIME
  parameter links stored objects to the reservation across an interrupted write. Recovery waits
  35 minutes after consumption (beyond the Convex runtime's 30-minute action limit), pages storage
  metadata in batches of 50, and never deletes a live referenced/claimed object. It preserves the
  original image MIME base type and does not expose the upload capability.
- Upload URLs minted by the old native-storage ingress should be drained before backend rollout;
  an unclaimed, unreferenced legacy result must be reuploaded rather than assigned a guessed owner.

## Attachment and accounting

`storageUsage.checkLimitAndAddUsage(ctx, actorId, storageId)` is the attachment entry point.
`actorId` must be session-derived. It verifies metadata and requires uploader ownership or an
explicit relationship to an existing referencing row; public readability alone is not attachment
permission. New claimed uploads are already metered; duplicate/shared references do not charge
those bytes again. Existing legacy owned references remain valid without a fabricated upload claim.

`subtractUsageForStorageId` schedules claimed-asset reconciliation after reference removal commits.
Cleanup checks every live reference before deleting bytes. Removing a single reference must not
remove a shared/duplicated blob. Unrelated field edits must not release image usage.
`users.recalculateUsage` includes pending claims and nested progress images, counts unique objects,
and preserves uploader attribution for shared claims.

Private progress photos do not inherit public-build visibility. Discovery requires the owner, an
explicit collaborator/group relationship, or explicit progress-feed publication. New progress
writes maintain `progressMediaReferences`; legacy nested refs use an indexed bridge selecting only
rows without `mediaIndexed`. Before high-volume rollout, the operator should invoke the internal
`files.indexLegacyProgress` on an authorized development target and validate it, then approve its
production run separately. It drains batches of 25 with resumable scheduling; queries stop reading
legacy rows once it completes. Tombstones never become pending previews. Historical Media wording
in `docs/backend-authorization.md` awaits its documentation-owner reconciliation to this approved
contract.

## Follow-up integration seams

- **Backfill:** S3 should invoke `checkLimitAndAddUsage` for each unique cloud storage ID before
  inserting new rows, never on a client-ID replay. Invoke `indexProgressMedia` after inserting
  a progress row. This replaces the existing fail-closed media-backfill seam; the row validator
  remains authoritative for shape/relationships.
- **Account deletion:** `accountDeletion:begin` immediately removes the app profile and normal
  consent row, blocks the deleted actor and account targets, and schedules checkpointed cleanup.
  A bounded build-quarantine pass finishes before child-table sweeps, so legacy social writers
  cannot add comments/likes after their cleanup phase. Owned references (including legacy tables
  and progress reverse indexes) are removed before media release. Nested historical photo arrays are enumerated separately in batches of 100. Each
  `releaseUserStorage(ctx, userId, cursor)` invocation returns a continuation/completion signal;
  callers repeat it rather than assuming one invocation drains an account. The app user may already
  be absent: refunds are conditional, and shared claim attribution transfers to a remaining owner
  even above cap. Concurrent reference changes invalidate media scan cursors transactionally through
  `storageReferenceEpochs`; uploads, reference removals, progress indexing and build duplication
  participate in that protocol. Completion includes consumed-upload recovery beyond the action
  runtime ceiling. Completed jobs clear raw identity, media worklists and cursors, retaining an
  opaque session-suppression hash plus status counters. No error payloads are logged or persisted.
  `accountDeletion:status` exposes internal, non-personal completion/failure information by opaque
  job ID; `accountDeletion:resume` retries a failed checkpoint without replaying committed chunks.
  These functions are internal operator interfaces, not permission to run cleanup or deploy on
  production. Regression coverage lives in `convex/accountDeletion.test.ts`.
- **R2:** P2 should consume verified uploader/size/unique-byte accounting and pending-claim semantics;
  it remains the sole final hosted-media architecture. Storage migration, deployment, and live data
  operations are separate operator gates.
