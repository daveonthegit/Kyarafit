import { replicaBackoffMs, type Replicator } from "./replicator";

/**
 * When managed sync runs. Triggers (app start, foreground, reconnect, a local commit, "Sync now")
 * all funnel into `request()`, which debounces bursts of edits into one pass; the replicator itself
 * is single flight. A transient failure schedules a retry with exponential backoff and jitter; an
 * expired session, a lapsed plan or being offline waits for its own trigger instead of polling.
 */

export interface ReplicaSchedulerOptions {
  /** Signed in as the vault's account and online. */
  canSync: () => boolean;
  /** The account is on Kyarafit Cloud (row sync runs only then). */
  isEntitled: () => boolean;
  /** Work after a successful row pass (photo bytes) and for every tier (publication removals). */
  afterPass?: (synced: boolean) => Promise<void | { remaining: number; failed: number }>;
  debounceMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  random?: () => number;
}

export class ReplicaScheduler {
  private debounce: unknown = null;
  private retry: unknown = null;
  private disposed = false;
  private inFlight: Promise<void> | null = null;
  /** A trigger arrived during a pass: run once more after it, so nothing waits for a later one. */
  private again = false;
  private followupFailures = 0;

  constructor(
    private readonly replicator: Replicator | null,
    private readonly options: ReplicaSchedulerOptions
  ) {}

  private set(fn: () => void, ms: number): unknown {
    return (this.options.setTimer ?? ((f, t) => setTimeout(f, t)))(fn, ms);
  }

  private clear(handle: unknown): void {
    if (handle != null)
      (this.options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>)))(
        handle
      );
  }

  /** A trigger fired: run soon, coalescing a burst of triggers into one pass. */
  request(): void {
    if (this.disposed) return;
    this.clear(this.debounce);
    this.debounce = this.set(() => {
      this.debounce = null;
      void this.run();
    }, this.options.debounceMs ?? 1500);
  }

  /** Run now ("Sync now", reconnect). Resolves when the pass (and its follow-up work) is done. */
  run(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.inFlight) {
      this.again = true;
      return this.inFlight;
    }
    this.clear(this.retry);
    this.retry = null;
    this.inFlight = this.pass().finally(() => {
      this.inFlight = null;
      if (this.again && !this.disposed) {
        this.again = false;
        void this.run();
      }
    });
    return this.inFlight;
  }

  private async pass(): Promise<void> {
    if (!this.options.canSync()) return;
    let synced = false;
    const replicator = this.replicator;
    if (replicator?.enabled && this.options.isEntitled()) {
      await replicator.sync();
      if (this.disposed) return;
      synced = replicator.status === "idle";
      if (replicator.status === "error") {
        this.retry = this.set(
          () => {
            this.retry = null;
            void this.run();
          },
          replicaBackoffMs(replicator.failures, this.options.random)
        );
      }
    }
    try {
      const result = await this.options.afterPass?.(synced);
      if (result && result.failed) throw new Error("Photo transfers failed");
      this.followupFailures = 0;
      if (result && result.remaining && !this.disposed) this.request();
    } catch (error) {
      console.warn("[sync] follow-up work failed", error);
      this.followupFailures += 1;
      if (!this.disposed) {
        this.clear(this.retry);
        this.retry = this.set(() => {
          this.retry = null;
          void this.run();
        }, replicaBackoffMs(this.followupFailures, this.options.random));
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    this.clear(this.debounce);
    this.clear(this.retry);
    this.debounce = null;
    this.retry = null;
  }
}
