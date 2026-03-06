/**
 * In-memory rate limiter for API routes (e.g. auth proxy).
 * Use for single-instance dev/small deployments; prefer edge/store (e.g. Redis) at scale.
 */

const windowMs = 60 * 1000; // 1 minute
const maxAuthPerWindow = 30; // auth endpoints: 30 req/min per IP
const maxGeneralPerWindow = 100; // other API: 100 req/min per IP

type Entry = { count: number; resetAt: number };

const authStore = new Map<string, Entry>();
const generalStore = new Map<string, Entry>();

function getKey(identifier: string): string {
  return identifier.trim() || "unknown";
}

function check(
  store: Map<string, Entry>,
  key: string,
  max: number
): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  let entry = store.get(key);
  if (!entry) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { ok: true };
  }
  if (now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { ok: true };
  }
  entry.count += 1;
  if (entry.count > max) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true };
}

/** Run cleanup of expired entries periodically to avoid unbounded growth. */
function prune(store: Map<string, Entry>): void {
  const now = Date.now();
  Array.from(store.entries()).forEach(([k, v]) => {
    if (now >= v.resetAt) store.delete(k);
  });
}
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    prune(authStore);
    prune(generalStore);
  }, 60 * 1000);
}

export function checkAuthRateLimit(identifier: string): { ok: boolean; retryAfter?: number } {
  return check(authStore, getKey(identifier), maxAuthPerWindow);
}

export function checkGeneralRateLimit(identifier: string): { ok: boolean; retryAfter?: number } {
  return check(generalStore, getKey(identifier), maxGeneralPerWindow);
}

export const RATE_LIMIT = {
  auth: { windowMs, maxPerWindow: maxAuthPerWindow },
  general: { windowMs, maxPerWindow: maxGeneralPerWindow },
} as const;
