import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Planner from "./page";
import type { Id } from "convex/_generated/dataModel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ userId: "user-1" }),
}));

const mockPlannerTasks = [
  {
    _id: "task1" as Id<"buildTasks">,
    label: "Finish wig",
    checked: false,
    buildId: "build1" as Id<"builds">,
    buildName: "Character A",
    dueDate: new Date().toISOString().slice(0, 10),
    sortOrder: 0,
  },
  {
    _id: "task2" as Id<"buildTasks">,
    label: "Order fabric",
    checked: true,
    buildId: "build2" as Id<"builds">,
    buildName: "Character B",
    dueDate: undefined,
    sortOrder: 1,
  },
];

const mockConventions = [
  {
    _id: "conv1" as Id<"conventions">,
    name: "Anime Expo",
    startDate: "2025-07-01",
    endDate: "2025-07-04",
    userId: "user-1",
  },
];

const useQueryMock = vi.fn((_apiFn: unknown, args: unknown) => {
  if (args === "skip") return undefined;
  if (typeof args === "object" && args !== null && "userId" in args) {
    const callCount = useQueryMock.mock.calls.length - 1;
    return callCount % 2 === 0 ? mockPlannerTasks : mockConventions;
  }
  return undefined;
});

vi.mock("convex/react", () => ({
  useQuery: useQueryMock,
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("@/components/layout/WebAppShell", () => ({
  WebAppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("Planner page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Daily and Events tabs", () => {
    render(<Planner />);
    expect(screen.getByRole("button", { name: /daily/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /events/i })).toBeInTheDocument();
  });

  it("shows progress summary when tasks are loaded", () => {
    render(<Planner />);
    expect(screen.getByText(/1 of 2 tasks/i)).toBeInTheDocument();
  });

  it("shows Deadline approaching section when tasks have due dates", () => {
    render(<Planner />);
    expect(screen.getByRole("heading", { name: /deadline approaching/i })).toBeInTheDocument();
  });

  it("shows task labels and build name links", () => {
    render(<Planner />);
    expect(screen.getByText("Finish wig")).toBeInTheDocument();
    expect(screen.getByText("Order fabric")).toBeInTheDocument();
    const linkA = screen.getByRole("link", { name: "Character A" });
    const linkB = screen.getByRole("link", { name: "Character B" });
    expect(linkA).toHaveAttribute("href", "/build-detail?id=build1");
    expect(linkB).toHaveAttribute("href", "/build-detail?id=build2");
  });

  it("shows Add task link to builds", () => {
    render(<Planner />);
    const addTask = screen.getByRole("link", { name: /add task/i });
    expect(addTask).toHaveAttribute("href", "/builds");
  });

  it("switching to Events tab shows event list with Plan and Packing links", async () => {
    const user = userEvent.setup();
    render(<Planner />);
    await user.click(screen.getByRole("button", { name: /events/i }));
    expect(screen.getByText("Anime Expo")).toBeInTheDocument();
    const planLinks = screen.getAllByRole("link", { name: /^plan$/i });
    const packingLinks = screen.getAllByRole("link", { name: /packing list/i });
    expect(planLinks.length).toBeGreaterThanOrEqual(1);
    expect(packingLinks.length).toBeGreaterThanOrEqual(1);
    expect(planLinks[0]).toHaveAttribute("href", "/conventions/conv1");
    expect(packingLinks[0]).toHaveAttribute("href", "/conventions/conv1/packing");
  });
});
