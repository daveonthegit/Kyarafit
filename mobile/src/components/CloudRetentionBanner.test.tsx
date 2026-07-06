import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  DOWNGRADE_GRACE_MS,
  DOWNGRADE_RETENTION_MS,
} from "@kyarafit/design-system/domain/tierTransition";
import { CloudRetentionBanner } from "./CloudRetentionBanner";

/**
 * Spec: DATA_AND_SYNC.md §10 (REQ-D96/D97). An informational, non-blocking banner reflects the
 * downgraded user's CLOUD backup phase. Paid / never-downgraded users see no banner. The domain
 * `cloudRetentionBanner` is the REAL shared helper so web/mobile cannot drift.
 */

const h = vi.hoisted(() => ({
  state: { downgradedAt: null as number | null },
}));

vi.mock("react-native", async () => {
  const { createReactNativeMock } = await import("@/test-support/rnMock");
  return createReactNativeMock();
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string; date?: unknown }) => {
      const base = opts?.defaultValue ?? key;
      return opts?.date != null ? base.replace("{{date}}", String(opts.date)) : base;
    },
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => ({ subject: "user_1" }),
}));

vi.mock("convex/_generated/api", () => ({
  api: { auth: { getCurrentUser: "auth:getCurrentUser" } },
}));

vi.mock("@/lib/useTier", () => ({
  useTier: () => ({
    data: {
      tier: "FREE",
      currentUsageMb: 0,
      storageLimitMb: 50,
      downgradedAt: h.state.downgradedAt,
    },
    isLoading: false,
  }),
}));

const NOW = 1_700_000_000_000;

afterEach(cleanup);

describe("CloudRetentionBanner (REQ-D96/D97)", () => {
  it("should_render_nothing_when_never_downgraded", () => {
    h.state.downgradedAt = null;
    const { container } = render(<CloudRetentionBanner now={NOW} />);
    expect(container.firstChild).toBeNull();
  });

  it("should_show_the_grace_message_during_the_grace_period", () => {
    h.state.downgradedAt = NOW - (DOWNGRADE_GRACE_MS - 1);
    render(<CloudRetentionBanner now={NOW} />);
    expect(screen.getByText(/Cloud backup active until/i)).toBeTruthy();
  });

  it("should_show_the_frozen_message_after_grace_within_retention", () => {
    h.state.downgradedAt = NOW - DOWNGRADE_GRACE_MS;
    render(<CloudRetentionBanner now={NOW} />);
    expect(screen.getByText(/Cloud backup frozen/i)).toBeTruthy();
  });

  it("should_show_the_expired_message_once_past_the_retention_window", () => {
    h.state.downgradedAt = NOW - DOWNGRADE_RETENTION_MS;
    render(<CloudRetentionBanner now={NOW} />);
    expect(screen.getByText(/Cloud backup expired/i)).toBeTruthy();
  });
});
