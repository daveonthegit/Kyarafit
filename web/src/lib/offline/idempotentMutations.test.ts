import { describe, it, expect } from "vitest";
import { isIdempotentMutation } from "./idempotentMutations";
import { isCreateMutation } from "./offlineCreateMutations";

// Spec: DATA_AND_SYNC.md §6 (REQ-D62). Every offline-enqueued mutation must be idempotent, and the
// registry must cover EVERY server handler that accepts an `idempotencyKey` (grep `convex/**` for
// `idempotencyKey`). This set is the source-of-truth mirror of that grep and is kept in parity with
// mobile's registry.
const IDEMPOTENT = [
  "builds:create",
  "builds:update",
  "builds:updateStatusMany",
  "builds:duplicate",
  "builds:addNodesToBuild",
  "conventions:create",
  "conventions:update",
  "conventions:archiveMany",
  "conventions:replacePlan",
  "conventions:addManualPackingItem",
  "workflow:create",
  "workflow:update",
  "workflow:move",
  "workflow:moveAndResequence",
  "users:setFocusedBuild",
  "buildProgressUpdates:add",
  "buildProgressUpdates:update",
  "buildReferenceImages:add",
  "buildProcessPictures:add",
] as const;

// Creates that run offline: return a doc with `_id` AND accept `idempotencyKey` (dedupe-safe replay).
const OFFLINE_CREATES = [
  "builds:create",
  "conventions:create",
  "workflow:create",
  "buildProgressUpdates:add",
  "buildReferenceImages:add",
  "buildProcessPictures:add",
] as const;

describe("idempotent mutation registry (REQ-D62)", () => {
  it("covers every handler that accepts an idempotencyKey", () => {
    for (const name of IDEMPOTENT) {
      expect(isIdempotentMutation(name), `${name} should be idempotent`).toBe(true);
    }
  });

  it("newly-added progress-update mutations are idempotent", () => {
    expect(isIdempotentMutation("buildProgressUpdates:add")).toBe(true);
    expect(isIdempotentMutation("buildProgressUpdates:update")).toBe(true);
  });

  it("build-media add mutations are idempotent", () => {
    expect(isIdempotentMutation("buildReferenceImages:add")).toBe(true);
    expect(isIdempotentMutation("buildProcessPictures:add")).toBe(true);
  });

  it("does not mark non-idempotent handlers as idempotent", () => {
    // These server handlers do NOT accept an idempotencyKey, so they must never be enqueued offline.
    expect(isIdempotentMutation("buildReferenceImages:remove")).toBe(false);
    expect(isIdempotentMutation("buildReferenceImages:reorder")).toBe(false);
    expect(isIdempotentMutation("conventions:deletePackingItem")).toBe(false);
    expect(isIdempotentMutation("builds:remove")).toBe(false);
  });
});

describe("offline create registry (REQ-D62)", () => {
  it("enqueues offline-safe creates", () => {
    for (const name of OFFLINE_CREATES) {
      expect(isCreateMutation(name), `${name} should be an offline create`).toBe(true);
    }
  });

  it("enqueues build-media add creates offline", () => {
    expect(isCreateMutation("buildReferenceImages:add")).toBe(true);
    expect(isCreateMutation("buildProcessPictures:add")).toBe(true);
  });

  it("every offline create is also idempotent", () => {
    for (const name of OFFLINE_CREATES) {
      expect(isIdempotentMutation(name), `${name} create must be idempotent`).toBe(true);
    }
  });

  it("does not enqueue non-create media mutations offline", () => {
    expect(isCreateMutation("buildReferenceImages:remove")).toBe(false);
    expect(isCreateMutation("buildProcessPictures:reorder")).toBe(false);
  });
});
