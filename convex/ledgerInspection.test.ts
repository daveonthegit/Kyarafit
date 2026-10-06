import "./mediaTestHelpers.fixture";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";
import * as deletion from "./accountDeletion";
import { DELETION_TABLES } from "./lib/accountDeletion";
import { deletionSubjectHash, PROOF_SUBJECT_LIMIT } from "./lib/deletionReferences";
import { initialLedgerCheckpoint, inspectLedgerChunk } from "./lib/ledgerInspection";
import { runIdempotent } from "./lib/idempotency";

const modules = import.meta.glob("./**/*.ts");
type Harness = ReturnType<typeof convexTest>;
const begin = makeFunctionReference<"mutation", { externalId: string }, Id<"accountDeletionJobs">>(
  "accountDeletion:begin"
);
const step = makeFunctionReference<
  "mutation",
  { jobId: Id<"accountDeletionJobs">; revision: number }
>("accountDeletion:step");
const resume = makeFunctionReference<"mutation", { jobId: Id<"accountDeletionJobs"> }>(
  "accountDeletion:resume"
);
const validate = makeFunctionReference<"mutation", Record<string, never>>(
  "idempotencyLedger:validateResults"
);
const operation = "fixtures.largeLedger";
const payloadOnly = "payload-only-value-not-a-checkpoint";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function harness() {
  return convexTest({ schema, modules, transactionLimits: true });
}
async function finish(t: Harness) {
  await Reflect.apply(t.finishAllScheduledFunctions, t, [vi.runAllTimers, 20000]);
}
async function tick(t: Harness, jobId: Id<"accountDeletionJobs">) {
  const job = (await t.run((ctx) => ctx.db.get(jobId)))!;
  await t.mutation(step, { jobId, revision: job.revision });
}
async function pendingLedger(t: Harness, jobId: Id<"accountDeletionJobs">) {
  for (let i = 0; i < 10; i++) {
    const job = (await t.run((ctx) => ctx.db.get(jobId)))!;
    if (job.ledgerRowId) return job;
    await tick(t, jobId);
  }
  throw new Error("Ledger checkpoint not reached");
}
async function seed(t: Harness, distinct: boolean, targeted = true, owner = "bob") {
  return t.run(async (ctx) => {
    for (const externalId of ["alice", "bob", "gamma"])
      await ctx.db.insert("users", {
        externalId,
        email: `${externalId}@example.invalid`,
        tier: "PRO",
        currentUsageMb: 0,
      });
    const alpha = await ctx.db.insert("builds", { userId: "alice", name: "Alpha", status: "idea" });
    const refs: Id<"builds">[] = [];
    for (let i = 0; i < (distinct ? 4100 : 1); i++)
      refs.push(await ctx.db.insert("builds", { userId: "bob", name: "Retained", status: "idea" }));
    const result = {
      notes: payloadOnly,
      references: distinct ? [...refs] : Array.from({ length: 4100 }, () => refs[0]),
    };
    if (targeted) result.references.push(alpha);
    const ledgerId = await ctx.db.insert("idempotencyLedger", {
      userId: owner,
      key: "large-key",
      operation,
      createdAt: Date.now(),
      result,
      resultRevision: "original",
    });
    return { alpha, refs, ledgerId };
  });
}
async function assertNoRepeat(t: Harness, message: string) {
  let effects = 0;
  await expect(
    t.withIdentity({ subject: "bob" }).run((ctx) =>
      runIdempotent(ctx, "large-key", "bob", operation, async () => {
        effects++;
        return null;
      })
    )
  ).rejects.toThrow(message);
  expect(effects).toBe(0);
}
async function invoke(ctx: MutationCtx, registered: object, args: object) {
  const handler = Reflect.get(registered, "_handler");
  if (typeof handler !== "function") throw new Error("Not registered");
  return handler(ctx, args);
}

describe("bounded ledger inspection", () => {
  for (const distinct of [true, false])
    it(`resumes 4,100 ${distinct ? "distinct" : "repeated"} references and retains a rejection marker`, async () => {
      const t = harness();
      const f = await seed(t, distinct);
      const jobId = await t.mutation(begin, { externalId: "alice" });
      await assertNoRepeat(t, "Replay validation pending");
      const before = await pendingLedger(t, jobId);
      await tick(t, jobId);
      const after = (await t.run((ctx) => ctx.db.get(jobId)))!;
      expect(after.phase).toBe(DELETION_TABLES.indexOf("idempotencyLedger"));
      expect(after.ledgerRowId).toBe(f.ledgerId);
      expect(after.ledgerCursor).not.toBe(before.ledgerCursor);
      expect(after.ledgerCursor).not.toContain(payloadOnly);
      for (const id of f.refs) expect(after.ledgerCursor).not.toContain(id);
      expect(after.ledgerSubjects?.length).toBeLessThanOrEqual(PROOF_SUBJECT_LIMIT);
      await t.mutation(resume, { jobId });
      await finish(t);
      const ledger = await t.run((ctx) => ctx.db.get(f.ledgerId));
      expect(ledger).toMatchObject({
        userId: "bob",
        key: "large-key",
        operation,
        replayBlocked: true,
        validatedEpoch: 1,
      });
      expect(ledger?.result).toBeUndefined();
      await assertNoRepeat(t, "Replay unavailable");
      const job = await t.run((ctx) => ctx.db.get(jobId));
      expect(job?.status).toBe("complete");
      for (const field of [
        "ledgerRowId",
        "ledgerCursor",
        "ledgerSubjects",
        "ledgerResultRevision",
        "ledgerGeneration",
      ])
        expect(Reflect.get(job!, field)).toBeUndefined();
      expect(await t.run((ctx) => ctx.db.get(f.alpha))).toBeNull();
      expect(await t.run((ctx) => ctx.db.get(f.refs[0]))).not.toBeNull();
    }, 60000);

  it("validates a retained 4,100-reference result without repeating its mutation", async () => {
    const t = harness();
    const f = await seed(t, true, false);
    const jobId = await t.mutation(begin, { externalId: "alice" });
    await finish(t);
    expect((await t.run((ctx) => ctx.db.get(jobId)))?.status).toBe("complete");
    const ledger = (await t.run((ctx) => ctx.db.get(f.ledgerId)))!;
    expect(ledger.replayBlocked).not.toBe(true);
    expect(ledger.validatedEpoch).toBe(1);
    expect(ledger.subjectHashes).toEqual([await deletionSubjectHash("bob")]);
    expect(ledger.result).toMatchObject({ notes: payloadOnly, references: f.refs });
    let effects = 0;
    const replay = await t.withIdentity({ subject: "bob" }).run((ctx) =>
      runIdempotent(ctx, "large-key", "bob", operation, async () => {
        effects++;
        return null;
      })
    );
    expect(replay).toEqual(ledger.result);
    expect(effects).toBe(0);
  }, 60000);

  it("deletes an owned large result before resolving any payload reference", async () => {
    const t = harness();
    const f = await seed(t, false, true, "alice");
    const jobId = await t.mutation(begin, { externalId: "alice" });
    await tick(t, jobId); // First phase drains consent.
    await t.run(async (ctx) => {
      const job = (await ctx.db.get(jobId))!;
      const reads = vi.spyOn(ctx.db, "get");
      await invoke(ctx, deletion.step, { jobId, revision: job.revision });
      expect(reads.mock.calls.some((args) => args.includes(f.refs[0]))).toBe(false);
    });
    expect(await t.run((ctx) => ctx.db.get(f.ledgerId))).toBeNull();
    await finish(t);
  });

  it("restarts after result content changes and after the deletion generation changes", async () => {
    const t = harness();
    const f = await seed(t, false, false);
    const jobId = await t.mutation(begin, { externalId: "alice" });
    await pendingLedger(t, jobId);
    await tick(t, jobId);
    await t.run((ctx) =>
      ctx.db.patch(f.ledgerId, {
        result: { userId: "alice" },
        resultRevision: "replacement",
      })
    );
    await tick(t, jobId);
    expect((await t.run((ctx) => ctx.db.get(f.ledgerId)))?.replayBlocked).toBe(true);
    await finish(t);

    const second = harness();
    const g = await seed(second, false, false);
    const alphaJob = await second.mutation(begin, { externalId: "alice" });
    await pendingLedger(second, alphaJob);
    await tick(second, alphaJob);
    expect((await second.run((ctx) => ctx.db.get(alphaJob)))?.ledgerSubjects).toContain(
      await deletionSubjectHash("bob")
    );
    await second.mutation(begin, { externalId: "bob" });
    await tick(second, alphaJob);
    expect((await second.run((ctx) => ctx.db.get(g.ledgerId)))?.replayBlocked).toBe(true);
    await finish(second);
  });

  it("rolls back a failed resource read, records no provider text, and resumes the same checkpoint", async () => {
    const t = harness();
    const f = await seed(t, false);
    const jobId = await t.mutation(begin, { externalId: "alice" });
    const before = await pendingLedger(t, jobId);
    await expect(
      t.run(async (ctx) => {
        const original = ctx.db.get.bind(ctx.db);
        vi.spyOn(ctx.db, "get").mockImplementation(async (...args) => {
          if (args.includes(f.refs[0])) throw new Error(payloadOnly);
          return Reflect.apply(original, ctx.db, args);
        });
        await invoke(ctx, deletion.step, { jobId, revision: before.revision });
      })
    ).rejects.toThrow(payloadOnly);
    expect(await t.run((ctx) => ctx.db.get(jobId))).toEqual(before);
    await t.mutation(resume, { jobId });
    await finish(t);
    expect((await t.run((ctx) => ctx.db.get(f.ledgerId)))?.result).toBeUndefined();
    const job = (await t.run((ctx) => ctx.db.get(jobId)))!;
    expect(job.status).toBe("complete");
    expect(JSON.stringify(job)).not.toContain(payloadOnly);
  });

  for (const large of [false, true])
    it(`counts inherited ${large ? "large" : "small"} resource reads against the four-read ceiling and persists only owner indices`, async () => {
      const t = harness();
      const padding = large ? "x".repeat(900000) : "";
      const refs = await t.run(async (ctx) => {
        const ids = [];
        for (let i = 0; i < 4; i++) {
          const userId = await ctx.db.insert("users", {
            externalId: `retained-${i}`,
            email: `${i}@example.invalid`,
            tier: "PRO",
            currentUsageMb: 0,
            bio: padding,
          });
          const groupId = await ctx.db.insert("groups", {
            createdBy: userId,
            name: "Retained",
            createdAt: 1,
            visibility: "public",
            description: padding,
          });
          const conventionId = await ctx.db.insert("conventions", {
            userId: `retained-${i}`,
            name: "Retained",
            startDate: "2026-01-01",
            endDate: "2026-01-02",
            location: padding,
          });
          ids.push(
            await ctx.db.insert("groupConventionDays", {
              groupId,
              conventionId,
              date: `2026-01-01${padding}`,
            })
          );
        }
        return ids;
      });
      let checkpoint = initialLedgerCheckpoint();
      let done = false;
      let chunks = 0;
      while (!done && chunks++ < 20) {
        const inspection = await t.run(async (ctx) => {
          const gets = vi.spyOn(ctx.db, "get");
          const inspected = await inspectLedgerChunk(ctx, { references: refs }, checkpoint);
          expect(gets.mock.calls.length).toBeLessThanOrEqual(4);
          return inspected;
        });
        expect(inspection.blocked).toBe(false);
        checkpoint = inspection.checkpoint;
        done = inspection.done;
        for (const id of refs) expect(JSON.stringify(checkpoint.walk)).not.toContain(id);
      }
      expect(done).toBe(true);
      expect(chunks).toBeGreaterThan(1);
      expect(checkpoint.subjects).toHaveLength(4);
    });

  it("maintenance resumes a large legacy result and drops its durable traversal state", async () => {
    const t = harness();
    const f = await seed(t, false, false);
    await t.mutation(validate, {});
    const state = await t.run((ctx) => ctx.db.query("ledgerValidationState").first());
    expect(state?.ledgerRowId).toBe(f.ledgerId);
    await t.mutation(validate, {});
    expect(
      (await t.run((ctx) => ctx.db.query("ledgerValidationState").first()))?.ledgerCursor
    ).not.toBe(state?.ledgerCursor);
    await finish(t);
    expect((await t.run((ctx) => ctx.db.get(f.ledgerId)))?.validatedEpoch).toBe(0);
    expect(await t.run((ctx) => ctx.db.query("ledgerValidationState").first())).toBeNull();
  });
});
