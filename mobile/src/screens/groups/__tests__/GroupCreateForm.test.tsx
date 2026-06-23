import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GroupCreateForm } from "../GroupCreateForm";

/**
 * Creating a group is a PAID action (PRODUCT_SPEC.md §3 REQ-019, §4.6 REQ-070). Behavioral parity
 * with the web group-create gating:
 *   - free users see a non-blocking upgrade affordance and cannot create (the action routes to the
 *     subscription screen instead of calling the mutation);
 *   - paid users create normally.
 * Joining/participating in a group stays free (REQ-019) and is never gated.
 *
 * The entitlement domain helper (`can` / `normalizeTier`) is the REAL shared implementation so
 * web/mobile cannot drift; RN primitives, router, Convex hooks, and `useTier` are mocked for jsdom.
 */

const h = vi.hoisted(() => ({
  state: {
    identity: { subject: "user_1" } as { subject: string } | null | undefined,
    tier: "FREE" as string | null,
  },
  createGroup: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("react-native", async () => {
  const { createReactNativeMock } = await import("@/test-support/rnMock");
  return createReactNativeMock();
});

vi.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: h.push, replace: h.replace }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => h.state.identity,
  useMutation: () => h.createGroup,
}));

vi.mock("convex/_generated/api", () => ({
  api: {
    auth: { getCurrentUser: "auth:getCurrentUser" },
    groups: { create: "groups:create" },
  },
}));

vi.mock("@/lib/useTier", () => ({
  useTier: () => ({
    data: h.state.tier ? { tier: h.state.tier, currentUsageMb: 0, storageLimitMb: 50 } : null,
    isLoading: false,
  }),
}));

vi.mock("@/components/OfflineBanner", () => ({ OfflineBanner: () => null }));

vi.mock("@/components/UpgradeNotice", async () => {
  const { createElement } = await import("react");
  return {
    UpgradeNotice: ({ message }: { message: string }) =>
      createElement("div", { "data-testid": "upgrade-notice" }, message),
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/ui", async () => {
  const { createElement } = await import("react");
  type Any = Record<string, unknown>;
  return {
    DataBoundary: ({ children }: { children: () => unknown }) => children() as never,
    SectionHeading: ({ title }: Any) => createElement("h2", null, title as never),
    MetaLabel: ({ children }: Any) => createElement("span", null, children as never),
    SurfaceCard: ({ children }: Any) => createElement("div", null, children as never),
    TextField: ({ label, value, onChangeText, placeholder }: Any) =>
      createElement("input", {
        "aria-label": label,
        placeholder,
        value: (value as string) ?? "",
        onChange: (e: { target: { value: string } }) =>
          (onChangeText as (t: string) => void)?.(e.target.value),
      }),
    Button: ({ title, onPress, disabled }: Any) =>
      createElement(
        "button",
        { onClick: disabled ? undefined : (onPress as () => void), disabled: Boolean(disabled) },
        title as never
      ),
  };
});

describe("GroupCreateForm gating (REQ-019, REQ-070)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.state.identity = { subject: "user_1" };
    h.state.tier = "FREE";
    h.createGroup.mockResolvedValue({ _id: "grp_1" });
  });

  afterEach(() => {
    cleanup();
  });

  it("should_block_group_create_for_free_user", () => {
    h.state.tier = "FREE";

    render(<GroupCreateForm />);

    // Non-blocking upgrade affordance is shown for free users.
    expect(screen.getByTestId("upgrade-notice").textContent).toBe("groups.createPaidNotice");

    // The primary action becomes an upgrade CTA, never the create action.
    const cta = screen.getByText("groups.createPaidAction");
    fireEvent.change(screen.getByLabelText("groups.nameLabel"), {
      target: { value: "Sailor Moon squad" },
    });
    fireEvent.click(cta);

    // Free users never call the create mutation; they are routed to the subscription screen.
    expect(h.createGroup).not.toHaveBeenCalled();
    expect(h.push).toHaveBeenCalledWith("/settings/subscription");
  });

  it("should_allow_group_create_for_paid_user", () => {
    h.state.tier = "PRO";

    render(<GroupCreateForm />);

    // No upgrade affordance for paid users.
    expect(screen.queryByTestId("upgrade-notice")).toBeNull();

    fireEvent.change(screen.getByLabelText("groups.nameLabel"), {
      target: { value: "Sailor Moon squad" },
    });
    fireEvent.click(screen.getByText("groups.createAction"));

    expect(h.createGroup).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_1", name: "Sailor Moon squad" })
    );
  });
});
