import { describe, expect, it } from "vitest";
import { parseLocalDate } from "@kyarafit/design-system/domain";

describe("parseLocalDate", () => {
  it("reads a date-only deadline as that local calendar day, never the day before", () => {
    const d = parseLocalDate("2026-12-12");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 11, 12, 0]);
  });

  it("parses full timestamps unchanged", () => {
    expect(parseLocalDate("2026-12-12T15:30:00.000Z").toISOString()).toBe(
      "2026-12-12T15:30:00.000Z"
    );
  });
});
