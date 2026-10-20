import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { makeFunctionReference } from "convex/server";
import { deleteVaultDatabase, getOfflineDb } from "@/offline/db";
import { setOfflineConnectivity } from "@/offline/connectivity";
import { NeedsConnectionError, useOfflineMutation } from "@/offline/useOfflineMutation";
import { useOfflineQuery } from "@/offline/useOfflineQuery";
import {
  bootVault,
  getActiveReplicator,
  getActiveVault,
  getVaultState,
  lockVault,
  unlockVault,
} from "./activeVault";
import { onVaultWriteError, runLocalMutation, runLocalMutations } from "./functions";
import { VAULT_IMAGE_TOKEN } from "./images";
import { VaultWriteError } from "./store";
import * as FileSystem from "expo-file-system/legacy";
import { useSaveLocalImage } from "@/lib/images/localImageStore";
import { useLocalId, useOnlineId } from "./hooks";
import { cachePublicationIdentities, publishVaultRow } from "./publications";
import type { ReplicaTransport } from "./replica/replicator";

/**
 * End-to-end vault behavior through the real hooks, active-vault lifecycle and SQLite schema
 * (expo-sqlite is backed by node:sqlite in tests; see test-support/nativeModuleMocks).
 */

const convex = vi.hoisted(() => ({
  useQueryArgs: [] as unknown[][],
  mutation: vi.fn(),
}));

vi.mock("@/lib/auth/bearer-storage-plugin", () => ({
  getBearerToken: () => "test-session",
  subscribeBearerToken: () => () => {},
}));
vi.mock("@/lib/auth/client", () => ({
  authClient: {
    getSession: async () => {
      const { getActiveVault } = await import("@/vault/activeVault");
      return { data: { user: { id: getActiveVault()?.subject } }, error: null };
    },
  },
}));

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => {
    convex.useQueryArgs.push(args);
    return undefined;
  },
  useConvex: () => ({ mutation: convex.mutation }),
}));

const ACCOUNT_A = { subject: "user_a", name: "A", email: "a@example.com", lastVerifiedAt: 1 };
const ACCOUNT_B = { subject: "user_b", name: "B", email: "b@example.com", lastVerifiedAt: 1 };
const fn = <T extends "query" | "mutation">(type: T, name: string) =>
  makeFunctionReference<T>(name);

beforeEach(async () => {
  convex.useQueryArgs = [];
  convex.mutation.mockReset();
  setOfflineConnectivity(true);
  await unlockVault(ACCOUNT_A);
});

afterEach(async () => {
  cleanup();
  await lockVault();
  await deleteVaultDatabase(ACCOUNT_A.subject);
  await deleteVaultDatabase(ACCOUNT_B.subject);
});

/** A photo already copied into the vault's image directory (see localImageStore.saveLocalImage). */
function photoUri(key: string): string {
  return `file:///documents/vaults/user_a-1a2b3c4d/images/${key}`;
}

/** Turn managed sync on for the open vault (what the first confirmed paid session does). */
function enableSync() {
  getActiveReplicator()!.enableReplication();
}

function outbox() {
  return getOfflineDb().getAllSync<{
    table_name: string;
    row_id: string;
    kind: string;
    fields_json: string | null;
  }>("SELECT table_name, row_id, kind, fields_json FROM replica_outbox ORDER BY seq");
}

/** A transport whose calls hang until the test resolves them. */
function hangingTransport() {
  const pending: ((value: unknown) => void)[] = [];
  const hang = () =>
    new Promise<never>((resolve) => {
      pending.push(resolve as (value: unknown) => void);
    });
  const transport: ReplicaTransport = {
    push: vi.fn(hang),
    pull: vi.fn(hang),
    dismissConflicts: vi.fn(hang),
  };
  return { transport, resolveAll: (value: unknown) => pending.splice(0).forEach((r) => r(value)) };
}

/** Live rows on disk in the open vault (what an export would read). */
function vaultRows() {
  return getOfflineDb()
    .getAllSync<{ table_name: string; id: string; json: string }>(
      "SELECT table_name, id, json FROM entity_rows WHERE deleted = 0 ORDER BY table_name, id"
    )
    .map((row) => ({
      table: row.table_name,
      id: row.id,
      doc: JSON.parse(row.json) as Record<string, unknown>,
    }));
}

describe("free user, offline: personal data never touches Convex", () => {
  it("rejects a photo save and its command when the vault changes during copying", async () => {
    let finishCopy!: () => void;
    const copy = vi.mocked(FileSystem.copyAsync);
    copy.mockClear();
    copy.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishCopy = resolve;
        })
    );
    const { result } = renderHook(() => ({
      save: useSaveLocalImage(),
      create: useOfflineMutation(fn("mutation", "builds:create")),
    }));
    const origin = result.current;
    const operation = (async () => {
      const image = await origin.save("file:///picked.jpg");
      await origin.create({ name: "A draft", status: "idea", imageUrl: image.uri } as never);
    })();
    const rejected = expect(operation).rejects.toThrow("active account changed");
    await vi.waitFor(() => expect(copy).toHaveBeenCalledTimes(1));
    await act(async () => {
      await unlockVault(ACCOUNT_B);
    });
    finishCopy();
    await rejected;
    expect(vaultRows()).toEqual([]);
  });

  it("rejects retained commands and photo callbacks after switching accounts", async () => {
    const copy = vi.mocked(FileSystem.copyAsync);
    copy.mockClear();
    const { result } = renderHook(() => ({
      save: useSaveLocalImage(),
      create: useOfflineMutation(fn("mutation", "builds:create")),
    }));
    const origin = result.current;
    const vault = getActiveVault();
    const image = await origin.save("file:///picked.jpg");
    copy.mockClear();
    await act(async () => {
      await unlockVault(ACCOUNT_B);
    });
    await expect(origin.save("file:///picked.jpg")).rejects.toThrow("active account changed");
    expect(copy).not.toHaveBeenCalled();
    await expect(
      origin.create({ name: "A draft", status: "idea", imageUrl: image.uri } as never)
    ).rejects.toThrow("active account changed");
    expect(() =>
      runLocalMutation("builds:create", { name: "A draft", status: "idea" }, vault)
    ).toThrow("active account changed");
    expect(vaultRows()).toEqual([]);
    await act(async () => {
      await result.current.create({ name: "B draft", status: "idea" } as never);
    });
    expect(vaultRows().map((row) => row.doc.name)).toEqual(["B draft"]);
  });
  it("refreshes both identity directions when account-wide publication identities arrive", () => {
    const build = runLocalMutation("builds:create", { name: "Local", status: "idea" }) as { _id: string };
    const { result } = renderHook(() => ({
      online: useOnlineId(build._id),
      local: useLocalId("server-build"),
    }));
    expect(result.current).toEqual({ online: undefined, local: "server-build" });
    act(() => cachePublicationIdentities(getOfflineDb(), [{ clientId: build._id, serverId: "server-build" }]));
    expect(result.current).toEqual({ online: "server-build", local: build._id });
  });

  it("refreshes identity consumers immediately after explicit publication", async () => {
    const build = runLocalMutation("builds:create", { name: "Published", status: "idea" }) as { _id: string };
    const { result } = renderHook(() => ({
      online: useOnlineId(build._id),
      local: useLocalId("server-published"),
    }));
    expect(result.current.online).toBeUndefined();
    convex.mutation.mockResolvedValue({ id: "server-published" });
    await act(async () => {
      await publishVaultRow({ mutation: convex.mutation }, "builds", build._id);
    });
    expect(result.current).toEqual({ online: "server-published", local: build._id });
  });

  it("does not write an old account's in-flight pull into the next vault", async () => {
    enableSync();
    const replicatorA = getActiveReplicator()!;
    const { transport, resolveAll } = hangingTransport();
    replicatorA.setTransport(transport);
    const syncing = replicatorA.sync();
    await vi.waitFor(() => expect(transport.pull).toHaveBeenCalledTimes(1));
    await unlockVault(ACCOUNT_B);
    resolveAll({
      rows: [{ table: "builds", rowId: "local:private-a", doc: { name: "Private" }, rev: 1 }],
      conflicts: [],
      cursor: 1,
      hasMore: false,
      resnapshot: false,
    });
    await syncing;
    expect(vaultRows()).toEqual([]);
    expect(
      getOfflineDb().getFirstSync("SELECT * FROM sync_meta WHERE key = 'replica:cursor'")
    ).toBeNull();
  });

  it("does not acknowledge another account's outbox after a stale push response", async () => {
    enableSync();
    runLocalMutation("builds:create", { name: "A", status: "idea" });
    const replicatorA = getActiveReplicator()!;
    const { transport, resolveAll } = hangingTransport();
    replicatorA.setTransport(transport);
    const syncing = replicatorA.sync();
    await vi.waitFor(() => expect(transport.push).toHaveBeenCalledTimes(1));
    await unlockVault(ACCOUNT_B);
    enableSync();
    runLocalMutation("builds:create", { name: "B", status: "idea" });
    resolveAll({ outcomes: [], head: 1 });
    await syncing;
    expect(outbox().map((op) => JSON.parse(op.fields_json ?? "{}").name)).toEqual(["B"]);
    expect(
      vaultRows()
        .filter((row) => row.table === "builds")
        .map((row) => row.doc.name)
    ).toEqual(["B"]);
  });

  it("creates a build with a photo offline, stored durably with a portable photo token", async () => {
    setOfflineConnectivity(false);
    const { result } = renderHook(() => useOfflineMutation(fn("mutation", "builds:create")));
    let created: { _id: string; imageUrl?: string } | undefined;
    await act(async () => {
      created = (await result.current({
        name: "Raiden",
        status: "idea",
        imageUrl: photoUri("img_hero"),
      } as never)) as never;
    });

    expect(convex.mutation).not.toHaveBeenCalled();
    expect(created?._id.startsWith("local:")).toBe(true);
    const row = getOfflineDb().getFirstSync<{ json: string; synced_at: number | null }>(
      "SELECT json, synced_at FROM entity_rows WHERE id = ?",
      [created!._id]
    );
    expect(JSON.parse(row!.json).imageUrl).toBe(`${VAULT_IMAGE_TOKEN}img_hero`);
    expect(row!.synced_at).toBeNull();
    // A free vault queues nothing for the cloud.
    expect(outbox()).toEqual([]);
  });

  it("reads personal queries from the vault and asks Convex to skip them, online or offline", () => {
    runLocalMutation("builds:create", { name: "Kept local", status: "wip" });
    const { result } = renderHook(() => useOfflineQuery(fn("query", "builds:list"), {} as never));
    expect((result.current as { name: string }[]).map((b) => b.name)).toEqual(["Kept local"]);
    expect(convex.useQueryArgs.every((args) => args[1] === "skip")).toBe(true);
  });

  it("re-renders queries after a local write", () => {
    const { result } = renderHook(() =>
      useOfflineQuery(fn("query", "conventions:list"), {} as never)
    );
    expect(result.current).toEqual([]);
    act(() => {
      runLocalMutation("conventions:create", {
        name: "Fanime",
        startDate: "2027-05-22",
        endDate: "2027-05-25",
      });
    });
    expect((result.current as { name: string }[]).map((c) => c.name)).toEqual(["Fanime"]);
  });

  it("serves the signed-in account as the current user without a network", () => {
    setOfflineConnectivity(false);
    const { result } = renderHook(() => useOfflineQuery(fn("query", "auth:getCurrentUser")));
    expect(result.current).toMatchObject({ subject: "user_a", email: "a@example.com" });
  });

  it("fails online-only actions fast offline instead of queueing them", async () => {
    setOfflineConnectivity(false);
    const { result } = renderHook(() => useOfflineMutation(fn("mutation", "buildLikes:like")));
    await expect(result.current({ buildId: "b" } as never)).rejects.toBeInstanceOf(
      NeedsConnectionError
    );
    expect(convex.mutation).not.toHaveBeenCalled();
  });
});

describe("paid vault: sync ops are durable and atomic", () => {
  it("queues a row op in the same transaction as the row, keyed to the vault id", () => {
    enableSync();
    const doc = runLocalMutation("builds:create", { name: "Synced", status: "idea" }) as {
      _id: string;
    };
    expect(outbox()).toEqual([
      expect.objectContaining({ table_name: "builds", row_id: doc._id, kind: "put" }),
    ]);
    expect(JSON.parse(outbox()[0].fields_json!)).toMatchObject({ name: "Synced", status: "idea" });
    expect(convex.mutation).not.toHaveBeenCalled();
  });

  it("queues nothing for a free vault", () => {
    runLocalMutation("builds:create", { name: "Local only", status: "idea" });
    expect(outbox()).toEqual([]);
  });
});

describe("compound explorer commands", () => {
  it.each([false, true])("rolls back a rejected attach after detaching (child=%s)", (child) => {
    enableSync();
    const build = runLocalMutation("builds:create", { name: "Build", status: "idea" }) as {
      _id: string;
    };
    const parent = runLocalMutation("cosplayNodes:create", {
      name: "Parent",
      nodeType: "element",
      buildId: build._id,
    }) as { _id: string };
    const moving = runLocalMutation("cosplayNodes:create", {
      name: "Moving",
      nodeType: "element",
      buildId: build._id,
    }) as { _id: string };
    const target = runLocalMutation("cosplayNodes:create", {
      name: "Target",
      nodeType: "element",
    }) as { _id: string };
    if (child)
      runLocalMutation("cosplayNodes:addChildLink", {
        parentNodeId: parent._id,
        childNodeId: moving._id,
      });
    runLocalMutation("cosplayNodes:addChildLink", {
      parentNodeId: moving._id,
      childNodeId: target._id,
    });
    const before = vaultRows();
    const queue = outbox();
    expect(() =>
      runLocalMutations([
        child
          ? { fn: "cosplayNodes:removeChildLink", args: { id: moving._id } }
          : {
              fn: "builds:removeNodeFromBuild",
              args: { buildId: build._id, cosplayNodeId: moving._id },
            },
        {
          fn: "cosplayNodes:addChildLink",
          args: { parentNodeId: target._id, childNodeId: moving._id },
        },
      ])
    ).toThrow("cycle");
    getActiveVault()!.reloadFromDisk();
    expect(vaultRows()).toEqual(before);
    expect(outbox()).toEqual(queue);
  });

  it("commits create/link and promotion with their sync ops", () => {
    enableSync();
    const build = runLocalMutation("builds:create", { name: "Build", status: "idea" }) as {
      _id: string;
    };
    const parent = runLocalMutation("cosplayNodes:create", {
      name: "Parent",
      nodeType: "element",
    }) as { _id: string };
    const [node] = runLocalMutations([
      { fn: "cosplayNodes:create", args: { name: "Child", nodeType: "element" } },
      {
        fn: "cosplayNodes:addChildLink",
        args: (results) => ({
          parentNodeId: parent._id,
          childNodeId: (results[0] as { _id: string })._id,
        }),
      },
    ]) as [{ _id: string }];
    expect(getActiveVault()!.reader().get(node._id)?.parentNodeId).toBe(parent._id);
    runLocalMutations([
      { fn: "cosplayNodes:removeChildLink", args: { id: node._id } },
      { fn: "builds:linkNodes", args: { buildId: build._id, cosplayNodeIds: [node._id] } },
    ]);
    getActiveVault()!.reloadFromDisk();
    expect(getActiveVault()!.reader().get(node._id)).toMatchObject({ buildId: build._id });
    expect(getActiveVault()!.reader().get(node._id)?.parentNodeId).toBeUndefined();
    const nodeOps = outbox().filter((op) => op.row_id === node._id);
    expect(JSON.parse(nodeOps[0].fields_json!)).toMatchObject({ parentNodeId: parent._id });
    expect(JSON.parse(nodeOps[nodeOps.length - 1].fields_json!)).toMatchObject({
      buildId: build._id,
      parentNodeId: null,
    });
  });
});

describe("failed local writes surface", () => {
  it("rejects with VaultWriteError, notifies the app once, and saves nothing", () => {
    const seen: VaultWriteError[] = [];
    const off = onVaultWriteError((error) => seen.push(error));
    const db = getOfflineDb() as unknown as { failNextWrite: ((sql: string) => boolean) | null };
    db.failNextWrite = (sql) => sql.includes("INSERT INTO entity_rows");

    expect(() => runLocalMutation("builds:create", { name: "Lost", status: "idea" })).toThrow(
      VaultWriteError
    );
    off();
    expect(seen).toHaveLength(1);
    expect(getActiveVault()!.reader().query("builds").collect()).toEqual([]);
  });
});

describe("sign-out locks the vault; it never deletes it", () => {
  it("keeps each account's data on disk across lock, relaunch and account switch", async () => {
    runLocalMutation("builds:create", { name: "A's build", status: "idea" });
    await lockVault();
    expect(getVaultState().status).toBe("locked");
    expect(() => getOfflineDb()).toThrow();

    // Another account on the same device gets its own, empty vault.
    await unlockVault(ACCOUNT_B);
    expect(getActiveVault()!.reader().query("builds").collect()).toEqual([]);
    runLocalMutation("builds:create", { name: "B's build", status: "idea" });

    // A signs back in: their build is still there, and B's is not visible.
    await unlockVault(ACCOUNT_A);
    expect(
      getActiveVault()!
        .reader()
        .query("builds")
        .collect()
        .map((b) => b.name)
    ).toEqual(["A's build"]);
  });

  it("relaunch offline reopens the last account's vault from disk", async () => {
    runLocalMutation("builds:create", { name: "Survives restart", status: "idea" });
    // Simulate a cold start: forget in-memory state but keep the persisted account + files.
    await bootVault();
    expect(getVaultState()).toMatchObject({ status: "unlocked", account: { subject: "user_a" } });
    expect(
      getActiveVault()!
        .reader()
        .query("builds")
        .collect()
        .map((b) => b.name)
    ).toEqual(["Survives restart"]);
  });
});
