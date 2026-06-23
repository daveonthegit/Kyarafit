import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlannerTaskRow } from "./PlannerWorkflowTaskUi";

// DESIGN_SYSTEM.md §6 / REQ-063: advanced planner fields are tucked behind an
// expand affordance, not shown up front. These tests assert that contract.

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const baseProps = {
  title: "Sew the cape",
  done: false,
  userId: "user_1",
  onToggle: () => {},
  contextHref: "/build-detail/b1",
  contextLabel: "Nezuko build",
  status: "in_progress",
  progressPercent: 40,
  dueDate: undefined,
  blockedByCount: 2,
  priority: 3,
  blockedByTitles: ["Cut fabric", "Buy thread"],
};

describe("Planner progressive disclosure", () => {
  it("should_hide_advanced_task_fields_by_default", () => {
    render(<PlannerTaskRow {...baseProps} />);

    // Essentials are visible up front.
    expect(screen.getByText("Sew the cape")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /mark "sew the cape" as complete/i })
    ).toBeInTheDocument();
    expect(screen.getByText("· 40%")).toBeInTheDocument();

    // The disclosure control exists and is collapsed by default.
    const disclosure = screen.getByRole("button", { name: /show details/i });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");

    // Advanced fields (status, priority, dependencies) stay hidden.
    expect(screen.queryByText("in progress")).not.toBeInTheDocument();
    expect(screen.queryByText(/priority/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/blocked by/i)).not.toBeInTheDocument();
  });

  it("should_reveal_advanced_fields_on_expand", () => {
    render(<PlannerTaskRow {...baseProps} />);

    const disclosure = screen.getByRole("button", { name: /show details/i });
    fireEvent.click(disclosure);

    // The same control now reports its expanded state.
    const expanded = screen.getByRole("button", { name: /hide details/i });
    expect(expanded).toHaveAttribute("aria-expanded", "true");

    // Advanced fields become visible after expanding.
    expect(screen.getByText("in progress")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText(/blocked by cut fabric, buy thread/i)).toBeInTheDocument();
  });
});
