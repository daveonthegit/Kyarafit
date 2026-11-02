import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MonogramPlate } from "./MonogramPlate";

it("shows the first initial and opens the cover picker from the add pill", () => {
  const onAdd = vi.fn();
  render(<MonogramPlate name="miles Morales" addLabel="Add a cover" onAdd={onAdd} />);
  expect(screen.getByTestId("monogram-plate")).toHaveTextContent("M");
  fireEvent.click(screen.getByRole("button", { name: /add a cover/i }));
  expect(onAdd).toHaveBeenCalledOnce();
});

it("offers no add action to viewers who cannot edit", () => {
  render(<MonogramPlate name="Katsucon" addLabel="Add a cover" />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getByTestId("monogram-plate")).toHaveTextContent("K");
});
