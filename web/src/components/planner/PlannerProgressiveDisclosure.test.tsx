import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { render as renderUi, screen, fireEvent, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../messages/en.json";

function render(ui: ReactNode) {
  return renderUi(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale="en" messages={messages}>
        {children}
      </NextIntlClientProvider>
    ),
  });
}
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

  it("should_check_the_task_immediately_on_press", () => {
    const onToggle = vi.fn(() => new Promise(() => {}));
    render(<PlannerTaskRow {...baseProps} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole("checkbox", { name: /mark "sew the cape" as complete/i }));

    // Feedback does not wait for the mutation to round-trip.
    expect(
      screen.getByRole("checkbox", { name: /mark "sew the cape" as incomplete/i })
    ).toBeChecked();
  });

  it("retires acknowledged state before a later remote reversal", async () => {
    const onToggle = vi.fn(() => new Promise(() => {}));
    const { rerender } = render(<PlannerTaskRow {...baseProps} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => {});
    expect(onToggle).toHaveBeenCalledWith(true);
    rerender(<PlannerTaskRow {...baseProps} done onToggle={onToggle} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
    rerender(<PlannerTaskRow {...baseProps} onToggle={onToggle} />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("forwards rapid requested values and ignores an older rejection", async () => {
    let rejectFirst!: (reason: Error) => void;
    const onToggle = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectFirst = reject;
          })
      )
      .mockImplementationOnce(() => new Promise(() => {}));
    render(<PlannerTaskRow {...baseProps} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => {});
    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => {});
    expect(onToggle.mock.calls).toEqual([[true], [false]]);
    await act(async () => {
      rejectFirst(new Error("Failed"));
    });
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("clears successful and rejected pending requests", async () => {
    const onToggle = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Failed"));
    const { rerender } = render(<PlannerTaskRow {...baseProps} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => {});
    rerender(<PlannerTaskRow {...baseProps} done onToggle={onToggle} />);
    rerender(<PlannerTaskRow {...baseProps} onToggle={onToggle} />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => {});
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("should_show_a_trailing_due_label_and_blocked_chip", () => {
    const { rerender } = render(
      <PlannerTaskRow {...baseProps} dueDate="2026-11-02" dueLabel="Due today" dueUrgent />
    );
    expect(screen.getByText("Due today")).toBeInTheDocument();

    rerender(<PlannerTaskRow {...baseProps} status="blocked" statusChipLabel="Blocked" />);
    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });
});
