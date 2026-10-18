import type { Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  initialLedgerWalk,
  nextLedgerNode,
  ownerReferences,
  PROOF_SUBJECT_LIMIT,
  type LedgerWalk,
  type Reference,
  type Row,
} from "./deletionReferences";
import { guardFor, MutationGuard } from "./guardedMutation";

export const LEDGER_NODE_BUDGET = 128;
export const LEDGER_REFERENCE_BUDGET = 4;
export type LedgerCheckpoint = { walk: LedgerWalk; subjects: string[] };
export function initialLedgerCheckpoint(): LedgerCheckpoint {
  return { walk: initialLedgerWalk(), subjects: [] };
}
class ChunkLimit extends Error {}

/** Four actual resource reads, including inherited owners; cursors contain paths/counters only. */
export async function inspectLedgerChunk(
  ctx: MutationCtx,
  result: unknown,
  checkpoint: LedgerCheckpoint
): Promise<{ done: boolean; blocked: boolean; checkpoint: LedgerCheckpoint }> {
  const guard = new MutationGuard(guardFor(ctx).raw);
  const resources = new Map<string, Reference[]>();
  const subjects = new Set(checkpoint.subjects);
  const owners = async (ref: Extract<Reference, { kind: "resource" }>) => {
    const key = `${ref.table}:${ref.value}`;
    const cached = resources.get(key);
    if (cached) return cached;
    if (resources.size === LEDGER_REFERENCE_BUDGET) throw new ChunkLimit();
    const row = await guard.raw.db.get(ref.value as Id<TableNames>);
    if (!row) throw new Error("Account unavailable");
    const refs = ownerReferences(guard.raw, ref.table, row as Row);
    resources.set(key, refs);
    return refs;
  };
  try {
    for (let i = 0; i < LEDGER_NODE_BUDGET; i++) {
      const pending = checkpoint.walk.owners;
      if (!pending) {
        const node = nextLedgerNode(ctx, result, checkpoint.walk);
        if (node.done)
          return {
            done: true,
            blocked: false,
            checkpoint: { walk: checkpoint.walk, subjects: [...subjects] },
          };
        if (node.ref) checkpoint.walk.owners = { path: node.path!, frames: [{ next: 0 }] };
        continue;
      }
      // Rehydrate only the current ownership path. No resource IDs or personal values are copied
      // into the checkpoint, and ancestor reads also count against this transaction's ceiling.
      let ref = nextLedgerNode(ctx, result, { frames: [{ path: pending.path, next: -1 }] }).ref;
      if (!ref) throw new Error("Unknown reference shape");
      const seen = new Set<string>();
      for (let depth = 0; depth < pending.frames.length - 1; depth++) {
        if (ref.kind !== "resource") throw new Error("Unknown reference shape");
        const key = `${ref.table}:${ref.value}`;
        if (seen.has(key)) throw new Error("Unknown reference shape");
        seen.add(key);
        ref = (await owners(ref))[pending.frames[depth].next - 1];
        if (!ref) throw new Error("Unknown reference shape");
      }
      if (ref.kind === "subject") {
        const hash = await guard.subject(ref.value);
        if (subjects.size < PROOF_SUBJECT_LIMIT) subjects.add(hash);
        pending.frames.pop();
      } else {
        if (seen.has(`${ref.table}:${ref.value}`)) throw new Error("Unknown reference shape");
        const refs = await owners(ref);
        const frame = pending.frames[pending.frames.length - 1];
        if (frame.next >= refs.length) pending.frames.pop();
        else {
          frame.next++;
          pending.frames.push({ next: 0 });
        }
      }
      if (!pending.frames.length) delete checkpoint.walk.owners;
    }
  } catch (error) {
    if (
      error instanceof Error &&
      ["Account unavailable", "Unknown reference shape"].includes(error.message)
    )
      return { done: true, blocked: true, checkpoint: initialLedgerCheckpoint() };
    if (!(error instanceof ChunkLimit)) throw error; // Transaction failure preserves the durable checkpoint.
  }
  return {
    done: false,
    blocked: false,
    checkpoint: { walk: checkpoint.walk, subjects: [...subjects] },
  };
}
