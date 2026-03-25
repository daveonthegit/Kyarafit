import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BuildNotesModal } from "./BuildNotesModal";

describe("BuildNotesModal", () => {
  const defaultProps = {
    open: true,
    notes: "",
    onNotesChange: () => {},
    onSave: () => {},
    onClear: () => {},
    onClose: () => {},
    saving: false,
    error: null,
  };

  it("renders nothing when closed", () => {
    const { container } = render(<BuildNotesModal {...defaultProps} open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders dialog with title and textarea when open", () => {
    render(<BuildNotesModal {...defaultProps} />);
    expect(screen.getByRole("dialog", { name: /notes/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /notes/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/build notes/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/add notes, references/i)).toBeInTheDocument();
  });

  it("shows Save, Clear notes, and Cancel buttons", () => {
    render(<BuildNotesModal {...defaultProps} />);
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear notes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("displays notes content in textarea", () => {
    render(<BuildNotesModal {...defaultProps} notes="My build reference" />);
    const textarea = screen.getByLabelText(/build notes/i);
    expect(textarea).toHaveValue("My build reference");
  });

  it("calls onNotesChange when user types", () => {
    const onNotesChange = vi.fn();
    render(<BuildNotesModal {...defaultProps} onNotesChange={onNotesChange} />);
    const textarea = screen.getByLabelText(/build notes/i);
    fireEvent.change(textarea, { target: { value: "x" } });
    expect(onNotesChange).toHaveBeenCalledWith("x");
  });

  it("calls onSave when Save is clicked", () => {
    const onSave = vi.fn();
    render(<BuildNotesModal {...defaultProps} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalled();
  });

  it("calls onClose when Close is clicked", () => {
    const onClose = vi.fn();
    render(<BuildNotesModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows error message when error is set", () => {
    render(<BuildNotesModal {...defaultProps} error="Failed to save" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to save");
  });

  it("disables Clear notes when notes is empty", () => {
    render(<BuildNotesModal {...defaultProps} notes="" />);
    expect(screen.getByRole("button", { name: /clear notes/i })).toBeDisabled();
  });

  it("enables Clear notes when notes has content", () => {
    render(<BuildNotesModal {...defaultProps} notes="something" />);
    expect(screen.getByRole("button", { name: /clear notes/i })).not.toBeDisabled();
  });

  it("shows Saving… when saving", () => {
    render(<BuildNotesModal {...defaultProps} saving />);
    expect(screen.getByRole("button", { name: /saving…/i })).toBeInTheDocument();
  });
});
