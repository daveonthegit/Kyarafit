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
  "elements:create",
  "elements:update",
  "elements:duplicateToBuild",
  "buildProgressUpdates:add",
  "buildProgressUpdates:update",
] as const;

// Creates that run offline: return a doc with `_id` AND accept `idempotencyKey` (dedupe-safe replay).
const OFFLINE_CREATES = [
  "builds:create",
  "conventions:create",
  "workflow:create",
  "elements:create",
  "buildProgressUpdates:add",
] as const;

describe("idempotent mutation registry (REQ-D62)", () => {
  it("covers every handler that accepts an idempotencyKey", () => {
    for (const name of IDEMPOTENT) {
      expect(isIdempotentMutation(name), `${name} should be idempotent`).toBe(true);
    }
  });

  it("newly-added elements and progress-update mutations are idempotent", () => {
    expect(isIdempotentMutation("elements:create")).toBe(true);
    expect(isIdempotentMutation("elements:update")).toBe(true);
    expect(isIdempotentMutation("elements:duplicateToBuild")).toBe(true);
    expect(isIdempotentMutation("buildProgressUpdates:add")).toBe(true);
    expect(isIdempotentMutation("buildProgressUpdates:update")).toBe(true);
  });

  it("does not mark non-idempotent handlers as idempotent", () => {
    // These server handlers do NOT accept an idempotencyKey, so they must never be enqueued offline.
    expect(isIdempotentMutation("buildReferenceImages:add")).toBe(false);
    expect(isIdempotentMutation("buildProcessPictures:add")).toBe(false);
    expect(isIdempotentMutation("conventions:deletePackingItem")).toBe(false);
    expect(isIdempotentMutation("builds:remove")).toBe(false);
  });
});

describe("offline create registry (REQ-D62)", () => {
  it("enqueues elements and build progress-update creates offline", () => {
    for (const name of OFFLINE_CREATES) {
      expect(isCreateMutation(name), `${name} should be an offline create`).toBe(true);
    }
  });

  it("every offline create is also idempotent", () => {
    for (const name of OFFLINE_CREATES) {
      expect(isIdempotentMutation(name), `${name} create must be idempotent`).toBe(true);
    }
  });

  it("does not enqueue non-idempotent media creates offline", () => {
    expect(isCreateMutation("buildReferenceImages:add")).toBe(false);
    expect(isCreateMutation("buildProcessPictures:add")).toBe(false);
  });
});
