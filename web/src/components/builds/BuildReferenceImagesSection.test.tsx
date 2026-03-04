import { describe, it, expect } from "vitest";
import { BuildReferenceImagesSection } from "./BuildReferenceImagesSection";

describe("BuildReferenceImagesSection", () => {
  it("exports a function component", () => {
    expect(typeof BuildReferenceImagesSection).toBe("function");
  });

  it("accepts buildId and userId props", () => {
    expect(BuildReferenceImagesSection).toHaveLength(1);
    const sig = BuildReferenceImagesSection.toString();
    expect(sig).toMatch(/buildId|userId/);
  });
});
