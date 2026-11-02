import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ElementPortfolioCardWeb } from "./ElementPortfolioCardWeb";

vi.mock("@/components/ui/ResolvedImage", () => ({
  ResolvedImage: ({ imageUrl }: { imageUrl?: string }) => <img alt="Cover" src={imageUrl} />,
}));

it.each(["compact", "comfortable", "grid"] as const)(
  "uses the element initial in the coverless %s layout and preserves supplied images",
  (variant) => {
    const item = {
      name: "Cape",
      nodeType: "element" as const,
      progressPercent: 0,
      childCount: 0,
      typeBadge: "Element",
      statusBadge: "Planned",
    };
    const { rerender } = render(
      <ElementPortfolioCardWeb
        variant={variant}
        item={item}
        progressLabel="0%"
        childrenLabel="No parts"
      />
    );
    expect(screen.getByTestId("monogram-fill")).toHaveTextContent("C");
    rerender(
      <ElementPortfolioCardWeb
        variant={variant}
        item={{ ...item, imageUrl: "https://example.com/cape.jpg" }}
        progressLabel="0%"
        childrenLabel="No parts"
      />
    );
    expect(screen.queryByTestId("monogram-fill")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Cover" })).toHaveAttribute(
      "src",
      "https://example.com/cape.jpg"
    );
  }
);
