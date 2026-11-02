import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  DEPRECATION_BANNER_DISMISSED_ATTR,
  DEPRECATION_BANNER_HEAD_SCRIPT,
  DEPRECATION_BANNER_STORAGE_KEY,
  DeprecationBanner,
} from "./DeprecationBanner";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      label: "Announcement",
      title: "Kyarafit is moving to Cosapp.si.",
      body: "Until then, everything here keeps working.",
      dismiss: "Dismiss announcement",
    })[key] ?? key,
}));

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute(DEPRECATION_BANNER_DISMISSED_ATTR);
  vi.restoreAllMocks();
});

describe("DeprecationBanner", () => {
  it("announces the move to Cosapp.si", () => {
    render(<DeprecationBanner />);
    const region = screen.getByRole("region", { name: "Announcement" });
    expect(region).toHaveTextContent("Kyarafit is moving to Cosapp.si.");
    expect(region).toHaveTextContent("everything here keeps working");
  });

  it("hides and remembers the dismissal in this browser", () => {
    render(<DeprecationBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss announcement" }));
    expect(screen.queryByRole("region", { name: "Announcement" })).not.toBeInTheDocument();
    expect(localStorage.getItem(DEPRECATION_BANNER_STORAGE_KEY)).toBe("1");
    expect(document.documentElement.hasAttribute(DEPRECATION_BANNER_DISMISSED_ATTR)).toBe(true);
  });

  it("still dismisses when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<DeprecationBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss announcement" }));
    expect(screen.queryByRole("region", { name: "Announcement" })).not.toBeInTheDocument();
  });

  it("head script marks <html> only when previously dismissed", () => {
    new Function(DEPRECATION_BANNER_HEAD_SCRIPT)();
    expect(document.documentElement.hasAttribute(DEPRECATION_BANNER_DISMISSED_ATTR)).toBe(false);
    localStorage.setItem(DEPRECATION_BANNER_STORAGE_KEY, "1");
    new Function(DEPRECATION_BANNER_HEAD_SCRIPT)();
    expect(document.documentElement.hasAttribute(DEPRECATION_BANNER_DISMISSED_ATTR)).toBe(true);
  });
});
