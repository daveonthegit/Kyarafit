import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BuildSummaryModal } from "./BuildSummaryModal";

const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const mockSummary = {
  status: "wip",
  progressPercent: 60,
  tasksChecked: 3,
  tasksTotal: 5,
  createdDate: "2024-01-15",
  targetDate: "2024-06-01",
  elapsedDays: 45,
  remainingDays: 78,
  linkedItemCount: 4,
  linkedItemsCompleteCount: 2,
  totalCostCents: 12000,
  budgetCents: 20000,
  budgetDifferenceCents: 8000,
};

describe("BuildSummaryModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <BuildSummaryModal
        open={false}
        onClose={() => {}}
        summary={mockSummary}
        formatCents={formatCents}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders dialog with Summary title and close button when open", () => {
    render(
      <BuildSummaryModal
        open={true}
        onClose={() => {}}
        summary={mockSummary}
        formatCents={formatCents}
      />
    );
    expect(screen.getByRole("dialog", { name: /summary/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /summary/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close summary/i })).toBeInTheDocument();
  });

  it("shows full summary content when open with summary data", () => {
    render(
      <BuildSummaryModal
        open={true}
        onClose={() => {}}
        summary={mockSummary}
        formatCents={formatCents}
      />
    );
    expect(screen.getByTestId("build-summary-content")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("2 of 4 complete")).toBeInTheDocument();
  });

  it("shows loading message when open with null summary", () => {
    render(
      <BuildSummaryModal open={true} onClose={() => {}} summary={null} formatCents={formatCents} />
    );
    expect(screen.getByText("Loading summary…")).toBeInTheDocument();
  });

  it("calls onClose when Close summary is clicked", () => {
    const onClose = vi.fn();
    render(
      <BuildSummaryModal
        open={true}
        onClose={onClose}
        summary={mockSummary}
        formatCents={formatCents}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /close summary/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
