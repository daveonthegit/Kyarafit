import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { Id } from "convex/_generated/dataModel";
import { BuildProgressTimeline } from "./BuildProgressTimeline";

interface TestUpdate {
  id: string;
  buildId: string;
  userId: string;
  createdAt: number;
  note?: string;
  progressPercent?: number;
  imageRefs: { kind: "url"; url: string }[];
  publishedToFeed: boolean;
}

const { addMock, state } = vi.hoisted(() => ({
  addMock: vi.fn((_args: Record<string, unknown>) => Promise.resolve(null)),
  state: { updates: [] as TestUpdate[], tier: "free" as "free" | "pro" },
}));

// The component reads/writes via the offline bridge (`useOfflineQuery`/`useOfflineMutation`). The
// bridge wraps `useQuery` (read) and, on the online path, calls `useConvex().mutation(ref, args)`
// (write). We route that write to the same `addMock` spy so the behavioral assertions are unchanged.
vi.mock("convex/react", () => ({
  useQuery: () => state.updates,
  useMutation: () => addMock,
  useConvex: () => ({
    mutation: (_ref: unknown, args: Record<string, unknown>) => addMock(args),
  }),
}));

vi.mock("@/lib/api/useTier", () => ({
  useFeatureAccess: () => ({ tier: state.tier }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const BUILD_ID = "build_1" as Id<"builds">;

function makeUpdate(overrides: Partial<TestUpdate>): TestUpdate {
  return {
    id: "u1",
    buildId: "build_1",
    userId: "user_1",
    createdAt: 1_000,
    imageRefs: [],
    publishedToFeed: false,
    ...overrides,
  };
}

describe("BuildProgressTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.updates = [];
    state.tier = "free";
  });

  it("should_show_empty_state_when_build_has_no_progress_updates", () => {
    state.updates = [];
    render(<BuildProgressTimeline buildId={BUILD_ID} userId="user_1" />);

    expect(screen.getByText(/no progress updates yet/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /progress updates/i })).toBeInTheDocument();
  });

  it("should_render_updates_newest_first", () => {
    state.updates = [
      makeUpdate({ id: "older", createdAt: 1_000, note: "Older update" }),
      makeUpdate({ id: "newer", createdAt: 5_000, note: "Newer update" }),
    ];
    render(<BuildProgressTimeline buildId={BUILD_ID} userId="user_1" />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Newer update")).toBeInTheDocument();
    expect(within(items[1]).getByText("Older update")).toBeInTheDocument();
  });

  it("should_block_publish_to_feed_for_free_user", async () => {
    state.tier = "free";
    render(<BuildProgressTimeline buildId={BUILD_ID} userId="user_1" />);

    // Free users get a non-blocking upgrade hint instead of a working publish toggle.
    expect(screen.queryByRole("checkbox", { name: /publish to feed/i })).not.toBeInTheDocument();
    expect(screen.getByText(/paid feature/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upgrade to publish/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/note/i), {
      target: { value: "A private update" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add update/i }));

    await waitFor(() => expect(addMock).toHaveBeenCalledTimes(1));
    const callArg = addMock.mock.calls[0][0] as { publish?: boolean };
    expect(callArg.publish).toBeUndefined();
    expect(callArg).toMatchObject({ note: "A private update" });
    expect(addMock).not.toHaveBeenCalledWith(expect.objectContaining({ publish: true }));
  });

  it("should_allow_paid_user_to_publish_to_feed", async () => {
    state.tier = "pro";
    render(<BuildProgressTimeline buildId={BUILD_ID} userId="user_1" />);

    fireEvent.change(screen.getByLabelText(/note/i), {
      target: { value: "Publish me" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /publish to feed/i }));
    fireEvent.click(screen.getByRole("button", { name: /add update/i }));

    await waitFor(() => expect(addMock).toHaveBeenCalledTimes(1));
    expect(addMock).toHaveBeenCalledWith(expect.objectContaining({ publish: true }));
  });
});
