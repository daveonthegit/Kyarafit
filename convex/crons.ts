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

export default crons;
