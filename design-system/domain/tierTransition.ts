/**
 * Pure logic for tier transitions (DATA_AND_SYNC.md §10, REQ-D95/96/97).
 *
 * - Upgrade backfill must be idempotent across devices (never duplicate rows already on the server).
 * - Downgrade must stop sync and PRESERVE local data — it must never delete the local store. Only the
 *   CLOUD mirror is ever affected, and only after a grace period + retention window.
 *
 * These functions are pure so they can be shared by the client (backfill planning, freeze UX) and the
 * Convex backend (backfill dedupe, downgrade-retention cron). Do NOT change the spec tests to match a
 * different behavior.
 */

export interface BackfillRow {
  /** Client-minted stable id used by the server idempotency ledger to dedupe upserts. */
  clientId: string;
  [key: string]: unknown;
}

/**
 * Rows to push during an upgrade backfill: only those whose clientId is not already present on the
 * server (dedupe across devices). Pure; preserves input order.
 */
export function selectBackfillRows<T extends BackfillRow>(
  localRows: T[],
  serverClientIds: string[]
): T[] {
  const present = new Set(serverClientIds);
  return localRows.filter((row) => !present.has(row.clientId));
}

export interface DowngradePlan {
  stopSync: boolean;
  keepLocalData: boolean;
  deleteLocalData: boolean;
}

/** Downgrade plan: stop sync, keep local data, never delete it. */
export function planDowngrade(): DowngradePlan {
  return { stopSync: true, keepLocalData: true, deleteLocalData: false };
}

/**
 * Grace period after a paid→free downgrade during which the CLOUD mirror is kept fully intact and a
 * re-subscribe resumes seamless sync (REQ-D96: "14-day grace").
 */
export const DOWNGRADE_GRACE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/**
 * Total retention window measured from the downgrade timestamp. Once elapsed, the retention cron may
 * purge the user's CLOUD copies of local-first data (REQ-D96: "~3 months"). Local on-device data is
 * NEVER affected by this window — it lives on the device, not in Convex.
 */
export const DOWNGRADE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // ~3 months

export type CloudRetentionPhase = "active" | "grace" | "frozen" | "purgeable";

/**
 * Lifecycle phase of a user's CLOUD mirror, given when (if ever) they downgraded paid→free.
 *
 * - `active`    Not downgraded (or re-subscribed): cloud is live and syncing.
 * - `grace`     Within {@link DOWNGRADE_GRACE_MS}: cloud kept fully intact; re-subscribe is seamless.
 * - `frozen`    Past grace, within retention: cloud is read-only; nothing is deleted yet.
 * - `purgeable` Past {@link DOWNGRADE_RETENTION_MS}: the cron may purge the CLOUD mirror (never local).
 *
 * `now` and `downgradedAt` are ms epoch timestamps; `downgradedAt == null` means "never downgraded".
 */
export function cloudRetentionPhase(
  downgradedAt: number | null | undefined,
  now: number
): CloudRetentionPhase {
  if (downgradedAt == null) return "active";
  const elapsed = now - downgradedAt;
  if (elapsed < DOWNGRADE_GRACE_MS) return "grace";
  if (elapsed < DOWNGRADE_RETENTION_MS) return "frozen";
  return "purgeable";
}

/**
 * The CLOUD mirror is frozen (read-only) once the grace period has elapsed, and stays frozen through
 * the retention window until it is purged. Never implies any local deletion.
 */
export function isCloudFrozen(downgradedAt: number | null | undefined, now: number): boolean {
  const phase = cloudRetentionPhase(downgradedAt, now);
  return phase === "frozen" || phase === "purgeable";
}

/**
 * The CLOUD mirror is eligible for purge only after the full retention window (REQ-D96/D97). This is
 * the exact predicate the downgrade-retention cron uses to select users; it never selects users still
 * in grace or freeze, and never has any bearing on local on-device data.
 */
export function isCloudPurgeable(downgradedAt: number | null | undefined, now: number): boolean {
  return cloudRetentionPhase(downgradedAt, now) === "purgeable";
}
