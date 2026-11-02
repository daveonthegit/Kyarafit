import { describe, it, expect, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { UpgradePrompt, FeatureGate } from "@/components/UpgradePrompt";
import { OnlineOnlyBanner } from "@/components/OnlineOnlyBanner";
import { CloudRetentionBanner } from "@/components/CloudRetentionBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { UnderlineInput } from "@/components/ui/UnderlineInput";
import { Button } from "@/components/ui/Button";
import { DOWNGRADE_GRACE_MS } from "@kyarafit/design-system/domain/tierTransition";

// Phase 8 accessibility gate. Renders a focused set of key web components in jsdom and asserts
// jest-axe finds zero WCAG 2.0/2.1 A/AA violations. These run as part of the normal web test suite
// (`npm run test -w web`) and via the dedicated `npm run test:a11y` script.
//
// The `region` (landmark) best-practice rule is disabled: it audits the whole page for landmark
// structure, which is a layout/page concern, not a property of an isolated component rendered in a
// bare jsdom body. Color-contrast is not evaluable in jsdom (no layout/paint) and axe-core skips it
// automatically. Every other default rule stays on, so these are real assertions.

expect.extend(toHaveNoViolations);

const axeOptions = { rules: { region: { enabled: false } } };

// Shared next-intl stub so the i18n-driven components render deterministic strings.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      offlineTitle: "You're offline",
      offlineMessage: "Social, groups, and sharing need a connection.",
      retry: "Retry",
      cloudGrace: `Cloud backup active until ${vars?.date}`,
      cloudFrozen: `Cloud backup frozen — resubscribe to keep syncing (removed ${vars?.date})`,
      cloudPurgeable: "Cloud backup expired — resubscribe to restore syncing",
    };
    return map[key] ?? key;
  },
}));

const { tierState } = vi.hoisted(() => ({
  tierState: { downgradedAt: null as number | null },
}));

vi.mock("@/lib/api/useTier", () => ({
  useTier: () => ({
    data: {
      tier: "FREE",
      currentUsageMb: 0,
      storageLimitMb: 50,
      downgradedAt: tierState.downgradedAt,
    },
    isLoading: false,
  }),
}));

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
}

afterEach(() => {
  setOnline(true);
  tierState.downgradedAt = null;
});

describe("accessibility (a11y gate)", () => {
  it("UpgradePrompt has no violations", async () => {
    const { container } = render(<UpgradePrompt message="Upgrade to sync across devices." />);
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });

  it("FeatureGate (gated state) has no violations", async () => {
    const { container } = render(
      <FeatureGate canUseFeature={false} message="Upgrade to export your data.">
        <span>Gated content</span>
      </FeatureGate>
    );
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });

  it("EmptyState has no violations", async () => {
    const { container } = render(
      <EmptyState
        icon="checkroom"
        message="No builds yet."
        secondary="Create your first build to get started."
      />
    );
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });

  it("OnlineOnlyBanner (offline state) has no violations", async () => {
    setOnline(false);
    const { container } = render(<OnlineOnlyBanner />);
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });

  it("CloudRetentionBanner (grace phase) has no violations", async () => {
    tierState.downgradedAt = Date.now() - (DOWNGRADE_GRACE_MS - 1);
    const { container } = render(<CloudRetentionBanner />);
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });

  it("a labeled form (UnderlineInput + Button) has no violations", async () => {
    const { container } = render(
      <form aria-label="Create build">
        <UnderlineInput label="Build name" aria-label="Build name" name="name" />
        <UnderlineInput
          label="Character"
          aria-label="Character"
          name="character"
          error="Required"
        />
        <Button type="submit">Create</Button>
      </form>
    );
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });
});
