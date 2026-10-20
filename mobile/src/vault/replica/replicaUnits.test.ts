// @vitest-environment node
import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import { migrateVaultSchema } from "@/offline/vaultSchema";
import { NodeSqliteDatabase } from "@/test-support/nodeSqlite";
import { referencedImageKeys, syncReplicaAssets, type ReplicaAssetIo } from "./assets";
import { classifyReplicaError } from "./convexTransport";
import {
  ReplicaAuthError,
  ReplicaEntitlementError,
  ReplicaOfflineError,
  Replicator,
  replicaBackoffMs,
} from "./replicator";
import { ReplicaScheduler } from "./scheduler";

function vaultSql() {
  const sql = new NodeSqliteDatabase();
  migrateVaultSchema(sql, "u");
  return sql;
}

function row(sql: NodeSqliteDatabase, table: string, id: string, doc: Record<string, unknown>) {
  sql.runSync(
    `INSERT INTO entity_rows (table_name, id, user_id, json, updated_at, synced_at, deleted)
     VALUES (?, ?, 'u', ?, 1, NULL, 0)`,
    [table, id, JSON.stringify(doc)]
  );
}

describe("replica error classification", () => {
  it("maps typed server codes and transport failures onto sync states", () => {
    expect(
      classifyReplicaError(new ConvexError({ code: "unauthorized", message: "x" }))
    ).toBeInstanceOf(ReplicaAuthError);
    expect(
      classifyReplicaError(new ConvexError({ code: "not-entitled", message: "x" }))
    ).toBeInstanceOf(ReplicaEntitlementError);
    expect(classifyReplicaError(new Error("Network request failed"))).toBeInstanceOf(
      ReplicaOfflineError
    );
    const server = new Error("[Request ID: 1] Server Error");
    expect(classifyReplicaError(server)).toBe(server);
  });

  it("backs off exponentially with jitter, capped at five minutes", () => {
    expect(replicaBackoffMs(1, () => 1)).toBe(2_000);
    expect(replicaBackoffMs(3, () => 1)).toBe(8_000);
    expect(replicaBackoffMs(3, () => 0)).toBe(4_000);
    expect(replicaBackoffMs(30, () => 1)).toBe(300_000);
  });
});

describe("replica scheduler", () => {
  function setup(status: "idle" | "error" | "needs-auth") {
    const timers: { fn: () => void; ms: number }[] = [];
    const replicator = {
      enabled: true,
      status,
      failures: 2,
      sync: vi.fn(async () => {}),
    } as unknown as Replicator;
    const afterPass = vi.fn(async () => {});
    const scheduler = new ReplicaScheduler(replicator, {
      canSync: () => true,
      isEntitled: () => true,
      afterPass,
      setTimer: (fn, ms) => timers.push({ fn, ms }),
      clearTimer: () => {},
      random: () => 1,
    });
    return { scheduler, replicator, timers, afterPass };
  }

  it("coalesces a burst of triggers into one debounced pass", async () => {
    const { scheduler, replicator, timers } = setup("idle");
    scheduler.request();
    scheduler.request();
    scheduler.request();
    expect(timers.map((t) => t.ms)).toEqual([1500, 1500, 1500]);
    timers[timers.length - 1].fn();
    await vi.waitFor(() => expect(replicator.sync).toHaveBeenCalledTimes(1));
  });

  it("schedules a backoff retry after a transient error, but not for an expired session", async () => {
    const failing = setup("error");
    await failing.scheduler.run();
    expect(failing.timers).toEqual([{ fn: expect.any(Function), ms: 4_000 }]);
    expect(failing.afterPass).toHaveBeenCalledWith(false);
    const signedOut = setup("needs-auth");
    await signedOut.scheduler.run();
    expect(signedOut.timers).toEqual([]);
  });

  it("runs one more pass when a trigger arrives during a pass", async () => {
    const { scheduler, replicator } = setup("idle");
    let release!: () => void;
    (replicator.sync as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise<void>((done) => (release = done))
    );
    const first = scheduler.run();
    await vi.waitFor(() => expect(replicator.sync).toHaveBeenCalledTimes(1));
    void scheduler.run(); // e.g. a local commit or reconnect while the pass is in flight
    void scheduler.run();
    release();
    await first;
    await vi.waitFor(() => expect(replicator.sync).toHaveBeenCalledTimes(2));
  });

  it("makes no call when it cannot sync, and runs follow-up work for every tier", async () => {
    const { replicator } = setup("idle");
    const afterPass = vi.fn(async () => {});
    await new ReplicaScheduler(replicator, {
      canSync: () => false,
      isEntitled: () => true,
      afterPass,
    }).run();
    expect(replicator.sync).not.toHaveBeenCalled();
    expect(afterPass).not.toHaveBeenCalled();
    await new ReplicaScheduler(replicator, {
      canSync: () => true,
      isEntitled: () => false,
      afterPass,
    }).run();
    expect(replicator.sync).not.toHaveBeenCalled();
    expect(afterPass).toHaveBeenCalledWith(false);
  });
});

describe("replica photo bytes", () => {
  function io(
    local: string[],
    remote: Record<string, string>
  ): ReplicaAssetIo & {
    calls: string[];
  } {
    const calls: string[] = [];
    return {
      calls,
      hasLocal: async (key) => local.includes(key),
      upload: async (key) => {
        calls.push(`upload:${key}`);
        return `storage-${key}`;
      },
      register: async (key, storageId) => {
        calls.push(`register:${key}:${storageId}`);
      },
      urls: async (keys) => {
        calls.push(`urls:${keys.join(",")}`);
        return keys
          .filter((key) => remote[key])
          .map((key) => ({ imageKey: key, url: remote[key] }));
      },
      download: async (key, url) => {
        calls.push(`download:${key}:${url}`);
      },
    };
  }

  it("collects only device photo keys referenced by live rows", () => {
    const sql = vaultSql();
    row(sql, "builds", "b1", { imageUrl: "kyarafit-image:img_a" });
    row(sql, "buildProgressUpdates", "p1", {
      imageRefs: [{ kind: "local", imageKey: "img_b", uri: "kyarafit-image:img_b" }],
    });
    row(sql, "conventions", "c1", { imageStorageId: "kg2abc", imageUrl: "https://x.test/a.jpg" });
    expect(referencedImageKeys(sql)).toEqual(["img_a", "img_b"]);
  });

  it("uploads photos only this device has, downloads ones it lacks, and skips known uploads", async () => {
    const sql = vaultSql();
    row(sql, "builds", "b1", { imageUrl: "kyarafit-image:img_mine" });
    row(sql, "builds", "b2", { imageUrl: "kyarafit-image:img_theirs" });
    row(sql, "builds", "b3", { imageUrl: "kyarafit-image:img_nowhere" });
    const first = io(["img_mine"], { img_theirs: "https://files.test/theirs" });
    expect(await syncReplicaAssets(sql, first)).toEqual({
      uploaded: 1,
      downloaded: 1,
      failed: 1,
      remaining: 0,
    });
    expect(first.calls).toEqual([
      "urls:img_mine,img_nowhere,img_theirs",
      "upload:img_mine",
      "register:img_mine:storage-img_mine",
      "download:img_theirs:https://files.test/theirs",
    ]);
    // Next pass: the uploaded photo needs no round trip.
    const second = io(["img_mine", "img_theirs"], {});
    await syncReplicaAssets(sql, second);
    expect(second.calls).toEqual(["urls:img_nowhere"]);
  });

  it("keeps going when one transfer fails, leaving it for the next pass", async () => {
    const sql = vaultSql();
    row(sql, "builds", "b1", { imageUrl: "kyarafit-image:img_a" });
    row(sql, "builds", "b2", { imageUrl: "kyarafit-image:img_b" });
    const flaky = io(["img_a", "img_b"], {});
    flaky.upload = async (key) => {
      if (key === "img_a") throw new Error("upload failed");
      return `storage-${key}`;
    };
    expect(await syncReplicaAssets(sql, flaky)).toEqual({
      uploaded: 1,
      downloaded: 0,
      failed: 1,
      remaining: 0,
    });
    expect(sql.getAllSync("SELECT image_key FROM replica_assets")).toEqual([
      { image_key: "img_b" },
    ]);
  });
});
