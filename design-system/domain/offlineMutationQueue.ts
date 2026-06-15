/**
 * Shared, platform-agnostic retry policy for the offline mutation queue / sync worker
 * (local-first plan, blueprint §3.13.3). Pure functions only — unit-testable in plain Node and
 * reused by both the mobile and future web sync workers so retry/backoff behaviour is identical.
 */

/** Max replay attempts before a queued mutation is marked permanently failed and surfaced. */
export const MAX_MUTATION_RETRIES = 10;

const BACKOFF_SCHEDULE_MS = [1000, 2000, 4000, 8000, 30000] as const;

/**
 * Backoff delay (ms) before the next replay attempt, given how many retries have already been
 * recorded. Ramps 1s → 2s → 4s → 8s and caps at 30s.
 */
export function nextMutationBackoffMs(retryCount: number): number {
  const idx = Math.min(Math.max(retryCount, 0), BACKOFF_SCHEDULE_MS.length - 1);
  return BACKOFF_SCHEDULE_MS[idx];
}

/** Whether a queued mutation with `retryCount` attempts should be retried again. */
export function shouldRetryMutation(retryCount: number): boolean {
  return retryCount < MAX_MUTATION_RETRIES;
}
