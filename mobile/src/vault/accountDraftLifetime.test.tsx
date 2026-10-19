import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppGroupLayout from "../../app/(app)/_layout";

const state = vi.hoisted(() => ({
  subject: "A",
  wait: Promise.resolve(),
}));
vi.mock("@/lib/auth/appSession", () => ({
  useAppSession: () => ({
    status: "signedIn",
    account: { subject: state.subject },
    connection: "verified",
  }),
}));
vi.mock("expo-router", () => ({ Stack: () => <Draft />, Redirect: () => null }));
vi.mock("expo-status-bar", () => ({ StatusBar: () => null }));
vi.mock("react-native", () => ({ View: () => null, ActivityIndicator: () => null }));
vi.mock("@/theme/glassNavigation", () => ({ glassHeaderOptions: () => ({}) }));
vi.mock("@/components/vault/VaultErrorScreen", () => ({ VaultErrorScreen: () => null }));

function Draft() {
  const [value, setValue] = useState("");
  return (
    <>
      <input value={value} onChange={(event) => setValue(event.target.value)} />
      <button
        onClick={async () => {
          await state.wait;
          setValue("A photo");
        }}
      >
        Pick
      </button>
    </>
  );
}
afterEach(cleanup);

describe("account-bound screen drafts", () => {
  it("discards the previous account's draft and delayed picker result", async () => {
    state.subject = "A";
    let finish!: () => void;
    state.wait = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const { rerender } = render(<AppGroupLayout />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "A draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Pick" }));
    state.subject = "B";
    rerender(<AppGroupLayout />);
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
    await act(async () => {
      finish();
      await state.wait;
    });
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
  });
});
