import type { ConvexReactClient } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { shouldRetryMutation } from "@kyarafit/design-system/domain/offlineMutationQueue";
import { getIsOnline } from "./connectivity";
import { isIdempotentMutation } from "./idempotentMutations";
import {
  bumpMutationRetry,
  deleteMutation,
  failMutation,
  listPendingMutations,
} from "./mutationQueue";

/** Inject the queued idempotency key into the args of mutations that dedupe replays server-side. */
function argsForReplay(fn: string, args: unknown, idempotencyKey: string): unknown {
  if (isIdempotentMutation(fn) && args !== null && typeof args === "object") {
    return { ...(args as Record<string, unknown>), idempotencyKey };
  }
  return args;
}

let draining = false;

export type DrainResult = { processed: number; failed: number };

/**
 * Replay queued offline mutations against Convex, FIFO. Single-flight (concurrent calls no-op).
 *
 * Ordering: rows are processed oldest-first, and on the first transient failure we stop the pass
 * (rather than skip ahead) so a not-yet-synced create never lets a later dependent op run out of
 * order. Successful rows are deleted; transient failures bump the retry counter (and stop the
 * pass for backoff); rows past the retry ceiling are marked `failed` so they stop blocking.
 *
 * Replay is at-least-once. Mutations listed in `idempotentMutations` carry the queued idempotency
 * key so the server dedupes a re-sent write (via the `idempotencyLedger`); others remain
 * at-least-once until they adopt `runIdempotent`.
 *
 * Connectivity-guarded: never runs while offline, and a failure that coincides with having gone
 * offline is treated as transient (not counted against the retry ceiling), so launching/operating
 * the app offline can never burn retries or drop a queued row.
 */
export async function drainMutationQueue(client: ConvexReactClient): Promise<DrainResult> {
  if (draining || !getIsOnline()) return { processed: 0, failed: 0 };
  draining = true;
  let processed = 0;
  let failed = 0;
  try {
    const pending = listPendingMutations();
    for (const row of pending) {
      let args: unknown;
      try {
        args = JSON.parse(row.args_json);
      } catch {
        // Corrupt args can never succeed — drop the row.
        deleteMutation(row.id);
        continue;
      }

      try {
        const callArgs = argsForReplay(row.fn, args, row.idempotency_key);
        await client.mutation(makeFunctionReference<"mutation">(row.fn), callArgs as never);
        deleteMutation(row.id);
        processed += 1;
      } catch {
        if (!getIsOnline()) {
          // Went offline mid-drain: treat as transient, don't penalize. Resume on reconnect.
          break;
        }
        if (shouldRetryMutation(row.retry_count + 1)) {
          bumpMutationRetry(row.id);
        } else {
          failMutation(row.id);
          failed += 1;
        }
        // Preserve FIFO: stop on first failure; the next trigger retries from here.
        break;
      }
    }
  } finally {
    draining = false;
  }
  return { processed, failed };
}
