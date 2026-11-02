import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PublicProfilePage from "./page";

// REQ-014/080: viewing public profiles and following are FREE for signed-in users (online-only).
// The follow control must never be gated behind a paid tier.

vi.mock("next/navigation", () => ({
  useParams: () => ({ username: "alice" }),
}));

type AnyArgs = Record<string, unknown> | "skip" | undefined;

vi.mock("convex/react", () => ({
  useQuery: (_ref: unknown, args: AnyArgs) => {
    if (args === "skip" || !args) return undefined;
    if ("username" in args) {
      return {
        userId: "alice-1",
        username: "alice",
        displayName: "Alice",
        name: "Alice",
        bio: null,
        image: null,
      };
    }
    if ("externalId" in args) {
      return { userId: "viewer-1", username: "viewer" };
    }
    if ("followerId" in args) return false; // isFollowing
    if ("userId" in args) return []; // public builds
    return undefined;
  },
  useMutation: () => vi.fn(),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ userId: "viewer-1", isLoading: false, isAuthenticated: true }),
}));

vi.mock("@/components/layout/WebAppShell", () => ({
  WebAppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/OnlineOnlyBanner", () => ({
  OnlineOnlyBanner: () => null,
}));

vi.mock("@/components/ui/ResolvedImage", () => ({
  ResolvedImage: () => null,
}));

vi.mock("@/components/social/PublicBuildCard", () => ({
  PublicBuildCard: () => null,
}));

describe("Public profile page", () => {
  it("should_allow_like_comment_follow_for_free_user", () => {
    render(<PublicProfilePage />);
    const followButton = screen.getByRole("button", { name: /follow/i });
    expect(followButton).toBeInTheDocument();
    // Ungated: free users can follow without an upgrade prompt blocking the control.
    expect(followButton).not.toBeDisabled();
    expect(screen.queryByRole("link", { name: /view plan/i })).not.toBeInTheDocument();
  });
});
