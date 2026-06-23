import { describe, it, expect } from "vitest";
import { mergeFieldLWW, type SyncRow } from "@kyarafit/design-system/domain/offlineConflict";

// Spec: DATA_AND_SYNC.md §6.1 (REQ-D65/66). Per-field last-write-wins.
interface BuildRow extends SyncRow {
  name?: string;
  character?: string;
  status?: string;
}

describe("mergeFieldLWW (REQ-D65/66)", () => {
  it("should_merge_per_field_when_two_devices_edit_different_fields", () => {
    const local: BuildRow = {
      name: "Local name",
      character: "Base",
      version: 2,
      updatedAt: 200,
      fieldUpdatedAt: { name: 200, character: 100 },
    };
    const remote: BuildRow = {
      name: "Base name",
      character: "Remote char",
      version: 2,
      updatedAt: 300,
      fieldUpdatedAt: { name: 100, character: 300 },
    };
    const merged = mergeFieldLWW(local, remote);
    expect(merged.name).toBe("Local name"); // local edited name later
    expect(merged.character).toBe("Remote char"); // remote edited character later
  });

  it("should_let_remote_newer_field_win", () => {
    const local: BuildRow = { status: "planned", fieldUpdatedAt: { status: 100 } };
    const remote: BuildRow = { status: "done", fieldUpdatedAt: { status: 200 } };
    expect(mergeFieldLWW(local, remote).status).toBe("done");
  });

  it("should_let_tombstone_win_over_older_edit", () => {
    const local: BuildRow = { name: "edited", updatedAt: 150, fieldUpdatedAt: { name: 150 } };
    const remote: BuildRow = { name: "old", deletedAt: 300, updatedAt: 300 };
    expect(mergeFieldLWW(local, remote).deletedAt).toBe(300);
  });

  it("should_break_equal_timestamp_ties_deterministically", () => {
    const local: BuildRow = {
      name: "L",
      version: 1,
      clientId: "a",
      fieldUpdatedAt: { name: 500 },
    };
    const remote: BuildRow = {
      name: "R",
      version: 2,
      clientId: "b",
      fieldUpdatedAt: { name: 500 },
    };
    // Equal field timestamp -> higher version wins.
    expect(mergeFieldLWW(local, remote).name).toBe("R");
  });
});
