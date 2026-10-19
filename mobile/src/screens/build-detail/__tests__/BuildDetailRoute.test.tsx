import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import BuildDetailScreen from "../../../../app/(app)/b/[buildId]";
import { lockVault, unlockVault } from "@/vault/activeVault";
import { runLocalMutation } from "@/vault/functions";
import { deleteVaultDatabase } from "@/offline/db";
import { setServerId } from "@/offline/idMap";

const h = vi.hoisted(() => ({
  routeId: "server-build",
  detail: vi.fn(),
  viewer: vi.fn(),
  options: vi.fn(),
}));
vi.mock("react-native", async () => {
  const { createReactNativeMock } = await import("@/test-support/rnMock");
  return createReactNativeMock();
});
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ buildId: h.routeId }),
  useNavigation: () => ({ setOptions: h.options }),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useConvex: () => ({ mutation: vi.fn() }),
}));
vi.mock("@/offline", async () => ({
  ...(await import("@/offline/useOfflineQuery")),
  ...(await import("@/offline/useOfflineMutation")),
}));
vi.mock("@/ui", () => ({
  DataBoundary: ({
    status,
    data,
    children,
    empty,
  }: {
    status: string;
    data: unknown;
    children: (data: unknown) => ReactNode;
    empty: ReactNode;
  }) => (status === "ready" ? children(data) : empty),
}));
vi.mock("@/ui/glass", () => ({ PhotoBackdrop: () => null }));
vi.mock("@/components/OfflineBanner", () => ({ OfflineBanner: () => null }));
vi.mock("@/screens/build-detail/DetailBody", () => ({
  BuildDetailBody: (props: { build: { name: string } }) => {
    h.detail(props);
    return <div>{props.build.name}</div>;
  },
}));
vi.mock("@/screens/public-build/PublicBuildDetailScreen", () => ({
  PublicBuildDetailScreen: ({ buildId }: { buildId: string }) => {
    h.viewer(buildId);
    return <div>Online viewer</div>;
  },
}));

beforeEach(async () => {
  vi.clearAllMocks();
  h.routeId = "server-build";
  await unlockVault({ subject: "route-owner", lastVerifiedAt: 1 });
});
afterEach(async () => {
  cleanup();
  await lockVault();
  await deleteVaultDatabase("route-owner");
});

it.each(["server", "local"])(
  "opens the editable local build and all related data from a %s route id",
  (representation) => {
    const build = runLocalMutation("builds:create", { name: "My build", status: "idea" }) as {
      _id: string;
    };
    const node = runLocalMutation("cosplayNodes:create", {
      name: "Element",
      nodeType: "element",
    }) as { _id: string };
    runLocalMutation("builds:addNodesToBuild", { buildId: build._id, cosplayNodeIds: [node._id] });
    const reference = runLocalMutation("buildReferenceImages:add", {
      buildId: build._id,
      imageUrl: "https://example.test/ref.jpg",
    }) as { _id: string };
    const process = runLocalMutation("buildProcessPictures:add", {
      buildId: build._id,
      imageUrl: "https://example.test/process.jpg",
    }) as { _id: string };
    setServerId(build._id, "server-build");
    if (representation === "local") h.routeId = build._id;
    render(<BuildDetailScreen />);
    expect(screen.getByText("My build")).toBeTruthy();
    expect(h.viewer).not.toHaveBeenCalled();
    expect(h.detail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        buildId: build._id,
        build: expect.objectContaining({ _id: build._id }),
        summary: expect.objectContaining({ linkedItemCount: 1 }),
        outlineNodes: expect.arrayContaining([expect.objectContaining({ _id: node._id })]),
        refImages: expect.arrayContaining([expect.objectContaining({ _id: reference._id })]),
        processPics: expect.arrayContaining([expect.objectContaining({ _id: process._id })]),
        onDelete: expect.any(Function),
      })
    );
  }
);

it("keeps the online read-only viewer for genuinely nonlocal builds", () => {
  h.routeId = "shared-build";
  render(<BuildDetailScreen />);
  expect(screen.getByText("Online viewer")).toBeTruthy();
  expect(h.viewer).toHaveBeenCalledWith("shared-build");
  expect(h.detail).not.toHaveBeenCalled();
});
