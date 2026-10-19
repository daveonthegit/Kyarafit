import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NewBuildModal } from "./NewBuildModal";
import { rememberLocalAccount } from "@/lib/auth/localAccount";
import { offlineRuntime } from "@/lib/offline/runtime";
import { InMemoryLocalStore } from "@/lib/offline/localStore";
import { setOfflineConnectivity } from "@/lib/offline/connectivity";

const state = vi.hoisted(() => ({ push: vi.fn(), mutation: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock("convex/react", () => ({ useConvex: () => ({ mutation: state.mutation }) }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ userId: "owner" }) }));
vi.mock("@/components/ui/ImageUpload", () => ({
  ImageUpload: ({
    onImageSelected,
  }: {
    onImageSelected: (image: { imageUrl: string }) => void;
  }) => (
    <button
      type="button"
      onClick={() => onImageSelected({ imageUrl: "data:image/png;base64,test" })}
    >
      Select image
    </button>
  ),
}));

afterEach(() => {
  offlineRuntime.lock();
  rememberLocalAccount(null);
  setOfflineConnectivity(true);
  vi.restoreAllMocks();
});

it("handles a rejected offline create without navigating, acknowledging success, or leaving queued data", async () => {
  rememberLocalAccount("owner");
  const store = new InMemoryLocalStore();
  offlineRuntime.setStore(store, "owner");
  setOfflineConnectivity(false);
  vi.spyOn(store, "commitCommand").mockRejectedValue(
    new DOMException("Disk full", "QuotaExceededError")
  );
  const alert = vi.spyOn(window, "alert").mockImplementation(() => undefined);
  const success = vi.fn();
  render(<NewBuildModal onDismiss={vi.fn()} onSuccessComplete={success} />);
  fireEvent.change(screen.getByPlaceholderText("e.g. Arlecchino"), {
    target: { value: "Unsaved build" },
  });
  fireEvent.click(screen.getByText("Select image"));
  fireEvent.click(screen.getByRole("button", { name: "Create build" }));
  await waitFor(() => expect(store.commitCommand).toHaveBeenCalledOnce());
  await waitFor(() => expect(screen.getByRole("button", { name: "Create build" })).toBeEnabled());
  expect(alert).toHaveBeenCalledOnce();
  expect(success).not.toHaveBeenCalled();
  expect(state.push).not.toHaveBeenCalled();
  expect(state.mutation).not.toHaveBeenCalled();
  expect(await store.listPendingMutations()).toEqual([]);
  expect(await store.listEntityRows()).toEqual([]);
});
