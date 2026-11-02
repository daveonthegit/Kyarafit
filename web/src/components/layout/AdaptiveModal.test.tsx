import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { AdaptiveModal } from "./AdaptiveModal";

function Harness({
  closeDisabled = false,
  save,
}: {
  closeDisabled?: boolean;
  save?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <AdaptiveModal
        open={open}
        onClose={() => setOpen(false)}
        title="New build"
        closeDisabled={closeDisabled || pending}
        footer={(close) => (
          <button type="button" onClick={close}>
            Cancel
          </button>
        )}
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setFailed(false);
            try {
              await save?.();
            } catch {
              setFailed(true);
            } finally {
              setPending(false);
            }
          }}
        >
          <input aria-label="Name" />
          <button type="submit" disabled={pending}>
            Save
          </button>
          {pending && <p>Saving</p>}
          {failed && <p role="alert">Save failed</p>}
        </form>
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

  it("preserves input focus through an Enter submission and a rejected save", async () => {
    const user = userEvent.setup();
    let rejectSave!: (reason: Error) => void;
    const save = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectSave = reject;
        })
    );
    render(<Harness save={save} />);
    const opener = screen.getByRole("button", { name: "Open" });
    await user.click(opener);
    const input = screen.getByRole("textbox", { name: "Name" });
    await user.click(input);
    await user.keyboard("Cape{Enter}");
    expect(save).toHaveBeenCalledOnce();
    expect(screen.getByText("Saving")).toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(input).toHaveFocus();
    await act(async () => rejectSave(new Error("Save failed")));
    expect(screen.getByRole("alert")).toHaveTextContent("Save failed");
    expect(input).toHaveFocus();
    expect(input).toHaveValue("Cape");
    expect(document.body.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
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
