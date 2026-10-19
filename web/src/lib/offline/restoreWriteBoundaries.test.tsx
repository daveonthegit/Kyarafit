import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import GroupDetailPage from "@/app/g/[groupId]/page";
import SeedClient from "@/app/dev/seed/SeedClient";
import { offlineRuntime } from "./runtime";
import { InMemoryLocalStore } from "./localStore";
import { createRestoreSession } from "../restoreSession";

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("convex/react", () => ({
  useMutation: () => mutate,
  useQuery: (fn: never) => {
    const name = getFunctionName(fn);
    if (name === "groups:getWithMembers") {
      return { group: { _id: "group", name: "Group" }, members: [], myRole: "admin" };
    }
    if (name === "builds:listByGroup") {
      return [{ _id: "linked", userId: "owner", name: "Linked build" }];
    }
    if (name === "builds:list") {
      return [{ _id: "available", userId: "owner", name: "Available build" }];
    }
    return [];
  },
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ groupId: "group" }) }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ userId: "owner" }) }));
vi.mock("@/components/layout/WebAppShell", () => ({
  WebAppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/layout/PhotoBackdrop", () => ({ PhotoBackdrop: () => null }));
vi.mock("@/components/OnlineOnlyBanner", () => ({ OnlineOnlyBanner: () => null }));

beforeEach(async () => {
  mutate.mockReset();
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  offlineRuntime.setStore(new InMemoryLocalStore(), "owner");
  const session = createRestoreSession("owner");
  await session.start();
  await session.record("builds", "restored-build");
});
afterEach(() => vi.restoreAllMocks());

describe("direct personal-data write boundaries", () => {
  it("refuses starter seed creation while a restore is incomplete", async () => {
    render(<SeedClient />);
    fireEvent.click(screen.getByRole("button", { name: "Load sample data" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Finish or undo your restore first.");
    expect(mutate).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith("Finish or undo your restore first.");
  });

  it("refuses both linking and unlinking builds from a group", async () => {
    render(<GroupDetailPage />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Linked build from group" }));
    await waitFor(() => expect(window.alert).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: /add.*build/i }));
    fireEvent.click(screen.getByRole("button", { name: /Available build/ }));
    await waitFor(() => expect(window.alert).toHaveBeenCalledTimes(2));
    expect(mutate).not.toHaveBeenCalled();
  });
});
