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
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      buildNamePlaceholder: "e.g. Arlecchino",
      createBuild: "Create build",
      creating: "Creating…",
      cancel: "Cancel",
    };
    return map[key] ?? key;
  },
}));
vi.mock("@/components/ui/ImageUpload", () => ({
  ImageUpload: ({
    onImageSelected,
    aside,
  }: {
    onImageSelected: (image: { imageUrl: string }) => void;
    aside?: React.ReactNode;
  }) => (
    <>
      <button
        type="button"
        onClick={() => onImageSelected({ imageUrl: "data:image/png;base64,test" })}
      >
        Select image
      </button>
      {aside}
    </>
  ),
}));

afterEach(() => {
  state.mutation.mockReset();
  state.push.mockReset();
  offlineRuntime.lock();
  rememberLocalAccount(null);
  setOfflineConnectivity(true);
  vi.restoreAllMocks();
});

it("creates the build on Convex and opens it", async () => {
  rememberLocalAccount("owner");
  const store = new InMemoryLocalStore();
  offlineRuntime.setStore(store, "owner");
  const commit = vi.spyOn(store, "commitCommand");
  state.mutation.mockResolvedValueOnce({ _id: "build-1" });
  const success = vi.fn();
  render(<NewBuildModal onDismiss={vi.fn()} onSuccessComplete={success} />);
  fireEvent.change(screen.getByPlaceholderText("e.g. Arlecchino"), {
    target: { value: "Saved build" },
  });
  fireEvent.click(screen.getByText("Select image"));
  fireEvent.click(screen.getByRole("button", { name: "Create build" }));
  await waitFor(() => expect(success).toHaveBeenCalledOnce());
  expect(state.mutation).toHaveBeenCalledOnce();
  expect(state.mutation.mock.calls[0][1]).toMatchObject({
    userId: "owner",
    name: "Saved build",
    imageUrl: "data:image/png;base64,test",
  });
  expect(state.push).toHaveBeenCalledWith("/build-detail/build-1");
  expect(commit).not.toHaveBeenCalled();
});

it("keeps the form open and sends nothing while offline", async () => {
  rememberLocalAccount("owner");
  offlineRuntime.setStore(new InMemoryLocalStore(), "owner");
  setOfflineConnectivity(false);
  const success = vi.fn();
  render(<NewBuildModal onDismiss={vi.fn()} onSuccessComplete={success} />);
  fireEvent.change(screen.getByPlaceholderText("e.g. Arlecchino"), {
    target: { value: "Offline build" },
  });
  fireEvent.click(screen.getByText("Select image"));
  fireEvent.click(screen.getByRole("button", { name: "Create build" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Create build" })).toBeEnabled());
  expect(state.mutation).not.toHaveBeenCalled();
  expect(success).not.toHaveBeenCalled();
  expect(state.push).not.toHaveBeenCalled();
});
