import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { AdaptiveModal } from "./AdaptiveModal";

function Harness({ closeDisabled = false }: { closeDisabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <AdaptiveModal
        open={open}
        onClose={() => setOpen(false)}
        title="New build"
        closeDisabled={closeDisabled}
        footer={(close) => (
          <button type="button" onClick={close}>
            Cancel
          </button>
        )}
      >
        <input aria-label="Name" />
      </AdaptiveModal>
    </>
  );
}

describe("AdaptiveModal", () => {
  it("renders an accessible modal dialog named by its title", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog", { name: "New build" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveFocus();
  });

  it("closes on Escape and returns focus to the opener", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(document, { key: "Escape" });
    // onClose waits for the exit motion, so the dialog is still mounted here.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it("closes from the footer's close handler", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("ignores Escape while closing is disabled", async () => {
    const onClose = vi.fn();
    render(
      <AdaptiveModal open onClose={onClose} title="Saving" closeDisabled>
        <p>Body</p>
      </AdaptiveModal>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Saving" })).toBeInTheDocument();
  });

  it("keeps Tab focus inside the dialog", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const cancel = screen.getByRole("button", { name: "Cancel" });
    cancel.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });
});
