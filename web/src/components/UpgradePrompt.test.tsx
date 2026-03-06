import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UpgradePrompt, FeatureGate } from "./UpgradePrompt";

describe("UpgradePrompt", () => {
  it("renders message and default link to subscription", () => {
    render(<UpgradePrompt message="Upgrade for backup and export." />);
    expect(screen.getByText("Upgrade for backup and export.")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /view plan/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/settings/subscription");
  });

  it("renders custom link text and href", () => {
    render(
      <UpgradePrompt
        message="Upgrade to sync."
        linkText="Upgrade now"
        linkHref="/settings/subscription"
      />
    );
    expect(screen.getByText("Upgrade to sync.")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /upgrade now/i });
    expect(link).toHaveAttribute("href", "/settings/subscription");
  });

  it("has accessible region label", () => {
    render(<UpgradePrompt message="Upgrade." />);
    const region = screen.getByRole("region", { name: /upgrade prompt/i });
    expect(region).toBeInTheDocument();
  });
});

describe("FeatureGate", () => {
  it("renders children when canUseFeature is true", () => {
    render(
      <FeatureGate canUseFeature={true} message="Upgrade.">
        <span>Gated content</span>
      </FeatureGate>
    );
    expect(screen.getByText("Gated content")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /view plan/i })).not.toBeInTheDocument();
  });

  it("renders UpgradePrompt when canUseFeature is false", () => {
    render(
      <FeatureGate canUseFeature={false} message="Upgrade for sync.">
        <span>Gated content</span>
      </FeatureGate>
    );
    expect(screen.getByText("Upgrade for sync.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view plan/i })).toBeInTheDocument();
    expect(screen.queryByText("Gated content")).not.toBeInTheDocument();
  });
});
