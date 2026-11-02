/**
 * App-wide record of the latest failed web write (ADR-0006). Web edits go straight to Convex, so a
 * screen that keeps its form open on error must never fail silently: `useOfflineMutation` reports
 * every failure here and `WriteFailureToast` shows it once, transiently.
 */

export class OfflineWriteError extends Error {
  constructor() {
    super("This action requires a connection.");
    this.name = "OfflineWriteError";
  }
}

export type WriteFailureKind = "offline" | "failed";

export interface WriteFailure {
  /** Increments per report so the same message twice still re-announces. */
  id: number;
  kind: WriteFailureKind;
  /** A user-facing reason from the server (ConvexError with a string payload), when one exists. */
  detail: string | null;
}

let current: WriteFailure | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function userFacingDetail(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: unknown }).data;
  if (typeof data === "string" && data.trim()) return data.trim();
  if (data && typeof data === "object") {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return null;
}

export function reportWriteFailure(error: unknown): void {
  current = {
    id: nextId++,
    kind: error instanceof OfflineWriteError ? "offline" : "failed",
    detail: error instanceof OfflineWriteError ? null : userFacingDetail(error),
  };
  emit();
}

export function dismissWriteFailure(id?: number): void {
  if (!current || (id !== undefined && current.id !== id)) return;
  current = null;
  emit();
}

export const writeFailures = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): WriteFailure | null {
    return current;
  },
};
