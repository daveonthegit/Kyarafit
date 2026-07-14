import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
// `vi.mock` calls below are hoisted above this import, so the component sees the mocked modules.
import { BuildProgressTimeline } from "../BuildProgressTimeline";

/**
 * Mobile "Progress updates" timeline (PRODUCT_SPEC.md §4.3 REQ-049, AC-07). Behavioral parity with
 * the web build timeline:
 *   - empty state when a build has no updates;
 *   - updates render newest-first (shared pure `sortProgressUpdates`, real — not mocked);
 *   - publishing to the social feed is paid → free users are blocked with a non-blocking hint.
 *
 * React Native primitives + the Convex/offline hooks + `useTier` are mocked so the screen component
 * can run under the offline vitest (jsdom) runner. The entitlement + ordering domain helpers are the
 * real shared implementations so web/mobile cannot drift.
 */

const h = vi.hoisted(() => ({
  state: {
    updates: undefined as unknown[] | undefined,
    tier: "FREE" as string | null,
  },
  addMock: vi.fn(),
}));

vi.mock("react-native", async () => {
  const { createReactNativeMock } = await import("@/test-support/rnMock");
  return createReactNativeMock();
});

vi.mock("convex/_generated/api", () => ({
  api: {
    buildProgressUpdates: {
      listByBuild: "buildProgressUpdates:listByBuild",
      add: "buildProgressUpdates:add",
    },
  },
}));

vi.mock("@/offline", () => ({
  useOfflineQuery: () => h.state.updates,
  useOfflineMutation: () => h.addMock,
}));

vi.mock("@/lib/useTier", () => ({
  useTier: () => ({
    data: h.state.tier ? { tier: h.state.tier, currentUsageMb: 0, storageLimitMb: 50 } : null,
    isLoading: false,
  }),
}));

vi.mock("@/ui", async () => {
  const { createElement } = await import("react");
  return {
    MetaLabel: ({ children }: { children: unknown }) =>
      createElement("span", null, children as never),
    SurfaceCard: ({ children }: { children: unknown }) =>
      createElement("div", null, children as never),
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key,
  }),
}));

type Args = { buildId: string; userId: string };
const props = { buildId: "build_1", userId: "user_1" } as unknown as Args;

function renderTimeline() {
  render(<BuildProgressTimeline buildId={props.buildId as never} userId={props.userId} />);
}

describe("BuildProgressTimeline (REQ-049, AC-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.state.updates = [];
    h.state.tier = "FREE";
    h.addMock.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
  });

  it("should_show_empty_state_when_build_has_no_progress_updates", () => {
    h.state.updates = [];

    renderTimeline();

    expect(screen.getByText("No progress updates yet")).toBeTruthy();
    expect(screen.getByText("Add your first progress update to start your timeline.")).toBeTruthy();
  });

  it("should_render_updates_newest_first", () => {
    // Intentionally provided out of order to exercise the component's own ordering.
    h.state.updates = [
      {
        _id: "older",
        id: "older",
        buildId: "build_1",
        userId: "user_1",
        createdAt: 100,
        note: "older entry",
        imageRefs: [],
        publishedToFeed: false,
      },
      {
        _id: "newer",
        id: "newer",
        buildId: "build_1",
        userId: "user_1",
        createdAt: 200,
        note: "newer entry",
        imageRefs: [],
        publishedToFeed: false,
      },
    ];

    renderTimeline();

    expect(screen.getByTestId("progress-update-note-0").textContent).toBe("newer entry");
    expect(screen.getByTestId("progress-update-note-1").textContent).toBe("older entry");
  });

  it("should_block_publish_to_feed_for_free_user", () => {
    h.state.tier = "FREE";
    h.state.updates = [];

    renderTimeline();

    const publishToggle = screen.getByRole("switch");
    expect(publishToggle.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(publishToggle);

    // Non-blocking upgrade hint surfaces and the toggle stays off (never publishes for free users).
    expect(
      screen.getByText(
        "Publishing updates to the feed is a paid feature. This update will stay private on your timeline."
      )
    ).toBeTruthy();
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
  });
});
