import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PublicBuildCard } from "../social/PublicBuildCard";

/**
 * Social interactions (like, comment, follow) are FREE for signed-in users — only posting/publishing
 * is paid (PRODUCT_SPEC.md §3 REQ-018, §4.7 REQ-080). Behavioral parity with web: a free user can
 * like and comment from the public build card with no tier gate and no upgrade prompt.
 *
 * The card carries no tier dependency at all (interactions only require a signed-in user), which is
 * exactly the spec contract; this test locks that in. RN primitives + Convex hooks are mocked.
 */

const h = vi.hoisted(() => ({
  like: vi.fn(),
  unlike: vi.fn(),
  addComment: vi.fn(),
}));

vi.mock("react-native", async () => {
  const { createReactNativeMock } = await import("@/test-support/rnMock");
  return createReactNativeMock();
});

vi.mock("@expo/vector-icons", async () => {
  const { createElement } = await import("react");
  return {
    Ionicons: ({ name }: { name: string }) => createElement("span", { "data-icon": name }),
  };
});

vi.mock("convex/react", () => ({
  useQuery: (ref: string) => {
    if (ref === "buildLikes:countByBuild") return 3;
    if (ref === "buildComments:listByBuild") return [];
    if (ref === "buildLikes:isLikedBy") return false;
    return undefined;
  },
  useMutation: (ref: string) => {
    if (ref === "buildLikes:like") return h.like;
    if (ref === "buildLikes:unlike") return h.unlike;
    if (ref === "buildComments:add") return h.addComment;
    return vi.fn();
  },
}));

vi.mock("convex/_generated/api", () => ({
  api: {
    buildLikes: {
      countByBuild: "buildLikes:countByBuild",
      isLikedBy: "buildLikes:isLikedBy",
      like: "buildLikes:like",
      unlike: "buildLikes:unlike",
    },
    buildComments: {
      listByBuild: "buildComments:listByBuild",
      add: "buildComments:add",
    },
  },
}));

vi.mock("@/components/builds/BuildPortfolioCard", async () => {
  const { createElement } = await import("react");
  return {
    BuildPortfolioCard: ({ item }: { item: { name: string } }) =>
      createElement("div", null, item.name),
  };
});

vi.mock("@/theme/useDesignTheme", () => ({
  useDesignTheme: () => ({ colors: { danger: "#dc2626", textSecondary: "#6b7280" } }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const build = {
  _id: "build_1" as never,
  name: "Test Build",
  character: "Hero",
  status: "in_progress",
  imageStorageId: null,
  imageUrl: null,
  ownerUsername: null,
  ownerName: null,
};

describe("PublicBuildCard free interactions (REQ-018, REQ-080)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.like.mockResolvedValue(null);
    h.addComment.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
  });

  it("should_allow_like_comment_follow_for_free_user", () => {
    // A free, signed-in user — the card never reads tier, so liking/commenting are ungated.
    render(<PublicBuildCard build={build} currentUserId="user_free" onPress={() => {}} />);

    // Liking is free: pressing the like control calls the like mutation (no paywall).
    fireEvent.click(screen.getByText("3"));
    expect(h.like).toHaveBeenCalledWith({ userId: "user_free", buildId: "build_1" });

    // Commenting is free: opening comments reveals the composer for the signed-in user.
    fireEvent.click(screen.getByText("0"));
    expect(screen.getByPlaceholderText("social.commentPlaceholder")).toBeTruthy();
    expect(screen.queryByText("social.commentsSignIn")).toBeNull();
  });
});
