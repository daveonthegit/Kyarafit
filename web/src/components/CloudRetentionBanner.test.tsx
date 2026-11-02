import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  DOWNGRADE_GRACE_MS,
  DOWNGRADE_RETENTION_MS,
} from "@kyarafit/design-system/domain/tierTransition";
import { CloudRetentionBanner } from "./CloudRetentionBanner";

// Spec: DATA_AND_SYNC.md §10 (REQ-D96/D97). An informational, non-blocking banner reflects the
// downgraded user's CLOUD backup phase. Paid / never-downgraded users see no banner.

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) => {
    const map: Record<string, string> = {
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

const NOW = 1_700_000_000_000;

describe("CloudRetentionBanner (REQ-D96/D97)", () => {
  it("should_render_nothing_when_never_downgraded", () => {
    tierState.downgradedAt = null;
    const { container } = render(<CloudRetentionBanner now={NOW} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("should_show_the_grace_message_during_the_grace_period", () => {
    tierState.downgradedAt = NOW - (DOWNGRADE_GRACE_MS - 1);
    render(<CloudRetentionBanner now={NOW} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/Cloud backup active until/i)).toBeInTheDocument();
  });

  it("should_show_the_frozen_message_after_grace_within_retention", () => {
    tierState.downgradedAt = NOW - DOWNGRADE_GRACE_MS;
    render(<CloudRetentionBanner now={NOW} />);
    expect(screen.getByText(/Cloud backup frozen/i)).toBeInTheDocument();
    expect(screen.getByText(/resubscribe/i)).toBeInTheDocument();
  });

  it("should_show_the_expired_message_once_past_the_retention_window", () => {
    tierState.downgradedAt = NOW - DOWNGRADE_RETENTION_MS;
    render(<CloudRetentionBanner now={NOW} />);
    expect(screen.getByText(/Cloud backup expired/i)).toBeInTheDocument();
  });
});
