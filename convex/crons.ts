import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Scheduled stubs for Expo Push broadcast delivery (Phase 7 expands these).
 */
const crons = cronJobs();

crons.interval(
  "broadcasts-deliver-due-stub",
  { minutes: 5 },
  internal.broadcasts.deliverDueStub,
  {}
);

crons.interval(
  "broadcasts-reconcile-receipts-stub",
  { minutes: 15 },
  internal.broadcasts.reconcileReceiptsStub,
  {}
);

// Bound the offline replay dedupe ledger by age (see convex/idempotencyLedger.ts).
crons.interval("idempotency-ledger-prune", { hours: 24 }, internal.idempotencyLedger.prune, {});

/**
 * Downgrade retention purge (DATA_AND_SYNC.md §10, REQ-D96/D97). Once daily, purge the CLOUD copies of
 * local-first data for users who downgraded paid→free and have stayed free past the retention window.
 * Selection is bounded + idempotent + guarded (see `tierTransition.purgeDowngradedCloudData`); it only
 * ever deletes Convex cloud-mirror rows, never local on-device data. Runs no-op until real users pass
 * their grace + retention window in production.
 */
crons.interval(
  "tier-downgrade-retention-purge",
  { hours: 24 },
  internal.tierTransition.purgeDowngradedCloudData,
  {}
);

export default crons;
