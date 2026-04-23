/** Matches mobile builds/elements list layout modes. */
export type PortfolioLayoutMode = "comfortable" | "compact" | "grid";

export const PORTFOLIO_LAYOUT_LABELS: Record<PortfolioLayoutMode, string> = {
  comfortable: "Comfortable",
  compact: "Compact",
  grid: "Grid",
};

export function cyclePortfolioLayout(current: PortfolioLayoutMode): PortfolioLayoutMode {
  if (current === "comfortable") return "compact";
  if (current === "compact") return "grid";
  return "comfortable";
}
