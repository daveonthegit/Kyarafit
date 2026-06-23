import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NewGroupModal } from "./NewGroupModal";

// REQ-019: creating a group is a paid action; joining/participating is free. The free user must see
// a non-blocking upgrade affordance instead of the create form, and the create mutation must be
// unreachable. Paid users get the normal form.

const h = vi.hoisted(() => ({
  tier: "free" as "free" | "pro" | "supporter",
  createGroup: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("convex/react", () => ({
  useMutation: () => h.createGroup,
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ userId: "user-1", isLoading: false, isAuthenticated: true }),
}));

vi.mock("@/lib/api/useTier", () => ({
  useFeatureAccess: () => ({ tier: h.tier, isPaid: h.tier !== "free" }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      groupCreatePaidMessage:
        "Creating a group is a paid feature. Joining and taking part in groups is always free.",
      viewPlan: "View plan",
    };
    return map[key] ?? key;
  },
}));

describe("NewGroupModal gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should_block_group_create_for_free_user", () => {
    h.tier = "free";
    render(<NewGroupModal onDismiss={vi.fn()} onSuccessComplete={vi.fn()} />);

    // Upgrade affordance links to subscription; no create form is rendered.
    expect(
      screen.getByText(/joining and taking part in groups is always free/i)
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /view plan/i });
    expect(link).toHaveAttribute("href", "/settings/subscription");
    expect(screen.queryByRole("button", { name: /create group/i })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/sailor moon squad/i)).not.toBeInTheDocument();
  });

  it("should_allow_group_create_for_paid_user", () => {
    h.tier = "pro";
    render(<NewGroupModal onDismiss={vi.fn()} onSuccessComplete={vi.fn()} />);

    expect(screen.getByPlaceholderText(/sailor moon squad/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create group/i })).toBeInTheDocument();
    expect(
      screen.queryByText(/joining and taking part in groups is always free/i)
    ).not.toBeInTheDocument();
  });
});
