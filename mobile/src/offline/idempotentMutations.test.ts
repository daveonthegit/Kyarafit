import { describe, it, expect } from "vitest";
import { isIdempotentMutation } from "./idempotentMutations";
import { isCreateMutation } from "./offlineCreateMutations";

// Spec: DATA_AND_SYNC.md §6 (REQ-D62). The mobile registry must cover EVERY server handler that
// accepts an `idempotencyKey` (grep `convex/**` for `idempotencyKey`) and stay in parity with web.
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
] as const;

const OFFLINE_CREATES = [
  "builds:create",
  "conventions:create",
  "workflow:create",
  "buildProgressUpdates:add",
] as const;

describe("mobile idempotent mutation registry (REQ-D62)", () => {
  it("covers every handler that accepts an idempotencyKey", () => {
    for (const name of IDEMPOTENT) {
      expect(isIdempotentMutation(name), `${name} should be idempotent`).toBe(true);
    }
  });

  it("does not mark non-idempotent handlers as idempotent", () => {
    expect(isIdempotentMutation("buildReferenceImages:add")).toBe(false);
    expect(isIdempotentMutation("buildProcessPictures:add")).toBe(false);
    expect(isIdempotentMutation("builds:remove")).toBe(false);
  });

  it("every offline create is idempotent and in parity with web", () => {
    for (const name of OFFLINE_CREATES) {
      expect(isCreateMutation(name), `${name} should be an offline create`).toBe(true);
      expect(isIdempotentMutation(name), `${name} create must be idempotent`).toBe(true);
    }
  });

  it("does not enqueue non-idempotent media creates offline", () => {
    expect(isCreateMutation("buildReferenceImages:add")).toBe(false);
    expect(isCreateMutation("buildProcessPictures:add")).toBe(false);
  });
});
