import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("./SeedClient", () => ({ default: () => <div>Development seed form</div> }));

import DevSeedPage from "./page";

afterEach(() => vi.unstubAllEnvs());

describe("development seed route", () => {
  it("returns not-found in production instead of mounting the seed form", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => DevSeedPage()).toThrow("NEXT_NOT_FOUND");
  });

  it("renders the seed form during development", () => {
    vi.stubEnv("NODE_ENV", "development");
    render(<DevSeedPage />);
    expect(screen.getByText("Development seed form")).toBeInTheDocument();
  });
});
