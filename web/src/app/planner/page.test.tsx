import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { plannerLocalDate, addDaysToPlannerDate } from "@/components/planner/groupPlannerTasks";
import PlannerPage from "./page";

const { move, update } = vi.hoisted(() => ({ move: vi.fn().mockResolvedValue(null), update: vi.fn().mockResolvedValue(null) }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("next-intl", () => ({ useLocale: () => "en", useTranslations: () => (key: string) => key }));
vi.mock("next/link", () => ({ default: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ userId: "alice" }) }));
vi.mock("@/components/layout/WebAppShell", () => ({ WebAppShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/layout/PhotoBackdrop", () => ({ PhotoBackdrop: () => null }));
vi.mock("@/components/ui/fullscreen-calendar", () => ({ FullScreenCalendar: () => null }));
vi.mock("@/lib/offline", () => ({
  useOfflineMutation: (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref) === "workflow:move" ? move : update,
  useOfflineQuery: (ref: Parameters<typeof getFunctionName>[0]) => {
    if (getFunctionName(ref) !== "workflow:listPlanner") return [];
    const today = plannerLocalDate();
    const common = { kind: "task", category: "craft", status: "not_started", sortOrder: 0, progressPercent: 0, buildId: "build", buildName: "Dress" };
    return [
      { ...common, _id: "parent", title: "Parent", dueDate: addDaysToPlannerDate(today, 1), ancestorIds: [] },
      { ...common, _id: "child", title: "Child", dueDate: today, parentId: "parent", ancestorIds: ["parent"] },
    ];
  },
}));

afterEach(() => vi.unstubAllGlobals());

it("allows promoting a stored child displayed as a root in a different time group", async () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  render(<PlannerPage />);
  fireEvent.pointerDown(screen.getByRole("button", { name: 'Drag "Child"' }), { pointerId: 1, clientX: 10, clientY: 10 });
  const promotion = screen.getByText("dropToRoot");
  vi.spyOn(promotion, "getBoundingClientRect").mockReturnValue({ top: 0, bottom: 50, left: 0, right: 100, width: 100, height: 50, x: 0, y: 0, toJSON: () => ({}) });
  fireEvent.pointerUp(window, { pointerId: 1, clientX: 10, clientY: 10 });
  await waitFor(() => expect(move).toHaveBeenCalledWith({ id: "child", userId: "alice", parentId: null, sortOrder: 1 }));
});
