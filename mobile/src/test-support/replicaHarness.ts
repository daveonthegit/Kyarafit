import { migrateVaultSchema } from "@/offline/vaultSchema";
import { LOCAL_MUTATIONS, LOCAL_QUERIES } from "@/vault/handlers";
import { VaultStore } from "@/vault/store";
import { Replicator, ReplicaOfflineError, type ReplicaTransport } from "@/vault/replica/replicator";
import { listChangesNotApplied } from "@/vault/replica/conflicts";
import { NodeSqliteDatabase } from "./nodeSqlite";

/**
 * Simulated phones for managed-sync scenarios: each device is the real vault (`VaultStore` over its
 * own SQLite database), running the real local handlers, with the real `Replicator` behind the
 * vault's commit hook. Only the network is simulated, through flags a scenario flips.
 */

export interface DeviceNet {
  online: boolean;
  /** False simulates an expired session: calls go out with an invalid credential. */
  tokenValid: boolean;
  /** Drop the push acknowledgement after the server committed the batch, once. */
  loseNextPushAck: boolean;
  /** Fail the Nth pull page of the next pass (1 = first page after the cursor). */
  failPullPage: number;
}

/** Where a scenario's devices sync to: `convex-test` in CI, or a real non-production deployment. */
export interface ReplicaBackend {
  /** The account the devices' vault belongs to. */
  subject: string;
  /** A transport for one device, honouring `net.online` / `net.tokenValid`. */
  transport(net: DeviceNet): ReplicaTransport;
}

let clock = 1_800_000_000_000;
export const tick = (ms = 1000) => (clock += ms);
export const now = () => clock;

export function makeDevice(
  name: string,
  backend: ReplicaBackend,
  { runId, replicate = true }: { runId: string; replicate?: boolean }
) {
  const sql = new NodeSqliteDatabase();
  migrateVaultSchema(sql, backend.subject);
  let seq = 0;
  let opSeq = 0;
  const net: DeviceNet = {
    online: true,
    tokenValid: true,
    loseNextPushAck: false,
    failPullPage: 0,
  };
  const base = backend.transport(net);
  let pulls = 0;
  const transport: ReplicaTransport = {
    push: async (deviceId, ops) => {
      if (!net.online) throw new ReplicaOfflineError();
      const result = await base.push(deviceId, ops);
      if (net.loseNextPushAck) {
        net.loseNextPushAck = false;
        throw new Error("acknowledgement lost after the server committed");
      }
      return result;
    },
    pull: async (after, limit) => {
      if (!net.online) throw new ReplicaOfflineError();
      pulls += 1;
      if (net.failPullPage > 0 && pulls === net.failPullPage) {
        net.failPullPage = 0;
        throw new Error("connection dropped mid-pull");
      }
      return base.pull(after, limit);
    },
    dismissConflicts: (ids) => {
      if (!net.online) return Promise.reject(new ReplicaOfflineError());
      return base.dismissConflicts(ids);
    },
  };
  let store: VaultStore | null = null;
  const replicator = new Replicator(sql, {
    newOpId: () => `${runId}-${name}-op-${++opSeq}`,
    now,
    onRowsChanged: () => store?.reloadFromDisk(),
  });
  replicator.setTransport(transport);
  store = new VaultStore({
    subject: backend.subject,
    sql,
    newId: () => `local:${runId}-${name}-${++seq}`,
    now,
    onPersist: replicator.recordChanges,
  });
  const vault = store;
  if (replicate) replicator.enableReplication();

  const mutate = <T = Record<string, unknown>>(fn: string, args: Record<string, unknown>): T =>
    vault.commit((db) =>
      LOCAL_MUTATIONS[fn]({ db, userId: backend.subject, now: tick() }, args)
    ) as T;
  const query = <T = unknown>(fn: string, args: Record<string, unknown> = {}): T =>
    LOCAL_QUERIES[fn]({ db: vault.reader(), userId: backend.subject, now: clock }, args) as T;
  const get = (id: string) => vault.reader().get(id);
  /** Live rows minus device bookkeeping, for convergence checks. */
  const snapshot = () => {
    const out: Record<string, Record<string, unknown>> = {};
    for (const row of vault.exportRows()) {
      const { updatedAt: _u, fieldUpdatedAt: _f, version: _v, ...doc } = row.doc;
      out[`${row.table}/${row.id}`] = doc;
    }
    return out;
  };
  const sync = async () => {
    pulls = 0;
    await replicator.sync();
  };
  const changes = (buildId?: string) => listChangesNotApplied(sql, vault.reader(), buildId);
  return { name, sql, store: vault, replicator, net, mutate, query, get, snapshot, sync, changes };
}
export type Device = ReturnType<typeof makeDevice>;

/** Build + element + nested element + task + photo, created on `d` (spike scenario S1). */
export function seedSlice(d: Device) {
  const build = d.mutate<{ _id: string }>("builds:create", { name: "Zelda", status: "wip" });
  const tunic = d.mutate<{ _id: string }>("cosplayNodes:create", {
    nodeType: "element",
    name: "Tunic",
  });
  d.mutate("builds:addNodesToBuild", { buildId: build._id, cosplayNodeIds: [tunic._id] });
  const belt = d.mutate<{ _id: string }>("cosplayNodes:create", {
    nodeType: "element",
    name: "Belt",
  });
  d.mutate("cosplayNodes:addChildLink", { parentNodeId: tunic._id, childNodeId: belt._id });
  const task = d.mutate<{ _id: string }>("workflow:create", {
    title: "Sew tunic",
    attachments: [{ entityType: "build", entityId: build._id }],
  });
  const photo = d.mutate<{ _id: string }>("buildReferenceImages:add", {
    buildId: build._id,
    imageUrl: "kyarafit-image:img_ref1",
  });
  return { build: build._id, tunic: tunic._id, belt: belt._id, task: task._id, photo: photo._id };
}

/** Sync every device in turn until a full round changes nothing. */
export async function settle(...devices: Device[]) {
  for (let round = 0; round < 4; round += 1) {
    for (const d of devices) await d.sync();
  }
}
