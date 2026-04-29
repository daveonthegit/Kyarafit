import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BuildSummarySection } from "./BuildSummarySection";

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

describe("BuildSummarySection", () => {
  it("renders nothing when summary is null", () => {
    const { container } = render(<BuildSummarySection summary={null} formatCents={formatCents} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders status and progress", () => {
    render(<BuildSummarySection summary={mockSummary} formatCents={formatCents} />);
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getAllByText("60%").length).toBeGreaterThan(0);
    expect(screen.getByText("3 of 5 tasks complete")).toBeInTheDocument();
  });

  it("renders dates and elapsed/remaining", () => {
    render(<BuildSummarySection summary={mockSummary} formatCents={formatCents} />);
    expect(screen.getByText(/15, 2024/)).toBeInTheDocument();
    expect(screen.getByText(/1, 2024/)).toBeInTheDocument();
    expect(screen.getByText("45 days")).toBeInTheDocument();
    expect(screen.getByText("78 days")).toBeInTheDocument();
  });

  it("renders linked items count", () => {
    render(<BuildSummarySection summary={mockSummary} formatCents={formatCents} />);
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
    expect(screen.getByText("Elements complete in this build")).toBeInTheDocument();
  });

  it("renders budget, spend, and difference", () => {
    render(<BuildSummarySection summary={mockSummary} formatCents={formatCents} />);
    expect(screen.getByText("$120.00")).toBeInTheDocument();
    expect(screen.getByText("$200.00")).toBeInTheDocument();
    expect(screen.getByText("+$80.00")).toBeInTheDocument();
  });

  it("omits due date and remaining when targetDate is null", () => {
    const noTarget = { ...mockSummary, targetDate: null, remainingDays: null };
    render(<BuildSummarySection summary={noTarget} formatCents={formatCents} />);
    expect(screen.getByText(/started/i)).toBeInTheDocument();
    expect(screen.getByText(/elapsed/i)).toBeInTheDocument();
    expect(screen.queryByText(/^due$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/remaining/i)).not.toBeInTheDocument();
  });

  it("shows linked items cost when no budget but items are linked", () => {
    const noBudget = { ...mockSummary, budgetCents: null, budgetDifferenceCents: null };
    render(<BuildSummarySection summary={noBudget} formatCents={formatCents} />);
    expect(screen.getByText(/linked elements cost/i)).toBeInTheDocument();
    expect(screen.getByText(/^total$/i)).toBeInTheDocument();
    expect(screen.getByText("$120.00")).toBeInTheDocument();
    expect(screen.queryByText(/total spend/i)).not.toBeInTheDocument();
  });

  it("omits cost section when no budget and no linked items", () => {
    const empty = {
      ...mockSummary,
      budgetCents: null,
      budgetDifferenceCents: null,
      linkedItemCount: 0,
      linkedItemsCompleteCount: 0,
      totalCostCents: 0,
    };
    render(<BuildSummarySection summary={empty} formatCents={formatCents} />);
    expect(screen.queryByText(/linked elements cost/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/total spend/i)).not.toBeInTheDocument();
  });
});
