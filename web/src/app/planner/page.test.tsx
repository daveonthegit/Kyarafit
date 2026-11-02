import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { plannerLocalDate, addDaysToPlannerDate } from "@/components/planner/groupPlannerTasks";
import PlannerPage from "./page";

const { move, update } = vi.hoisted(() => ({
  move: vi.fn().mockResolvedValue(null),
  update: vi.fn().mockResolvedValue(null),
}));
let plannerRows: Record<string, unknown>[] | null = null;
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: { title?: string }) =>
    key === "dragTask" ? `Drag "${values?.title}"` : key,
}));
vi.mock("next/link", () => ({
  default: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ userId: "alice" }) }));
vi.mock("@/components/layout/WebAppShell", () => ({
  WebAppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/layout/PhotoBackdrop", () => ({ PhotoBackdrop: () => null }));
vi.mock("@/components/ui/fullscreen-calendar", () => ({ FullScreenCalendar: () => null }));
vi.mock("@/lib/offline", () => ({
  useOfflineMutation: (ref: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(ref) === "workflow:move" ? move : update,
  useOfflineQuery: (ref: Parameters<typeof getFunctionName>[0]) => {
    if (getFunctionName(ref) !== "workflow:listPlanner") return [];
    if (plannerRows) return plannerRows;
    const today = plannerLocalDate();
    const common = {
      kind: "task",
      category: "craft",
      status: "not_started",
      sortOrder: 0,
      progressPercent: 0,
      buildId: "build",
      buildName: "Dress",
    };
    return [
      {
        ...common,
        _id: "parent",
        title: "Parent",
        dueDate: addDaysToPlannerDate(today, 1),
        ancestorIds: [],
      },
      {
        ...common,
        _id: "child",
        title: "Child",
        dueDate: today,
        parentId: "parent",
        ancestorIds: ["parent"],
      },
    ];
  },
}));

beforeEach(() => {
  plannerRows = null;
  move.mockReset().mockResolvedValue(null);
  update.mockReset().mockResolvedValue(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("keeps Friday before Wednesday after dragging across due dates in This week", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-02T12:00:00"));
  vi.stubGlobal("PointerEvent", MouseEvent);
  const common = {
    kind: "task",
    category: "craft",
    status: "not_started",
    progressPercent: 0,
    buildId: "build",
    buildName: "Dress",
    ancestorIds: [],
  };
  plannerRows = [
    { ...common, _id: "wed", title: "Wednesday", dueDate: "2026-11-04", sortOrder: 0 },
    { ...common, _id: "fri", title: "Friday", dueDate: "2026-11-06", sortOrder: 1 },
  ];
  move.mockImplementation(async (args) => {
    plannerRows = plannerRows!.map((row) => (row._id === args.id ? { ...row, ...args } : row));
    return null;
  });
  update.mockImplementation(async (args) => {
    plannerRows = plannerRows!.map((row) => (row._id === args.id ? { ...row, ...args } : row));
    return null;
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement
  ) {
    const top = this.dataset.plannerTaskDropId === "wed" ? 100 : 220;
    return {
      top,
      bottom: top + 100,
      left: 0,
      right: 100,
      width: 100,
      height: 100,
      x: 0,
      y: top,
      toJSON: () => ({}),
    };
  });
  const { rerender } = render(<PlannerPage />);
  expect(
    screen
      .getAllByRole("button", { name: /^Drag/ })
      .map((button) => button.getAttribute("aria-label"))
  ).toEqual(['Drag "Wednesday"', 'Drag "Friday"']);
  fireEvent.pointerDown(screen.getByRole("button", { name: 'Drag "Friday"' }), {
    clientX: 10,
    clientY: 250,
  });
  fireEvent.pointerUp(window, { clientX: 10, clientY: 105 });
  await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
  rerender(<PlannerPage />);
  expect(
    screen
      .getAllByRole("button", { name: /^Drag/ })
      .map((button) => button.getAttribute("aria-label"))
  ).toEqual(['Drag "Friday"', 'Drag "Wednesday"']);
});

it("allows promoting a stored child displayed as a root in a different time group", async () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  render(<PlannerPage />);
  fireEvent.pointerDown(screen.getByRole("button", { name: 'Drag "Child"' }), {
    pointerId: 1,
    clientX: 10,
    clientY: 10,
  });
  const promotion = screen.getByText("dropToRoot");
  vi.spyOn(promotion, "getBoundingClientRect").mockReturnValue({
    top: 0,
    bottom: 50,
    left: 0,
    right: 100,
    width: 100,
    height: 50,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  fireEvent.pointerUp(window, { pointerId: 1, clientX: 10, clientY: 10 });
  await waitFor(() =>
    expect(move).toHaveBeenCalledWith({
      id: "child",
      userId: "alice",
      parentId: null,
      sortOrder: 1,
    })
  );
});
