import { describe, it, expect } from "vitest";
import { BuildProcessPicturesSection } from "./BuildProcessPicturesSection";

describe("BuildProcessPicturesSection", () => {
  it("exports a function component", () => {
    expect(typeof BuildProcessPicturesSection).toBe("function");
  });

  it("accepts buildId and userId props", () => {
    expect(BuildProcessPicturesSection).toHaveLength(1);
    const sig = BuildProcessPicturesSection.toString();
    expect(sig).toMatch(/buildId|userId/);
  });
});
