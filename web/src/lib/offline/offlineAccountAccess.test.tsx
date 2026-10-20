import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { api } from "convex/_generated/api";
import { useOfflineMutation } from "./useOfflineMutation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AuthGate } from "@/components/AuthGate";
import { readLocalAccount, rememberLocalAccount } from "@/lib/auth/localAccount";
import { readLocalCollections } from "@/lib/localFirstData";
import { SyncWorkerProvider } from "./SyncWorkerProvider";
import { InMemoryLocalStore } from "./localStore";
import { offlineRuntime } from "./runtime";

const state = vi.hoisted(() => ({
  identity: undefined as { subject: string } | null | undefined,
  online: false,
  session: null as object | null,
  pending: false,
  stores: new Map<string, unknown>(),
  redirect: vi.fn(),
  query: vi.fn(async () => null),
  mutation: vi.fn(async () => null),
}));
vi.mock("convex/react", () => ({
  useQuery: () => state.identity,
  useConvex: () => ({ query: state.query, mutation: state.mutation }),
  useMutation: () => state.mutation,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/builds",
  useRouter: () => ({ replace: state.redirect }),
}));
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { useSession: () => ({ data: state.session, isPending: state.pending }) },
}));
vi.mock("@/lib/api/useTier", () => ({
  useTier: () => ({ data: { tier: "PRO" } }),
}));
vi.mock("./engineSelection", () => ({
  createBrowserLocalStore: async (subject: string) => state.stores.get(subject),
}));

function AccountView() {
  const { userId, isLoading } = useCurrentUser();
  const create = useOfflineMutation(api.builds.create);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <span>{isLoading ? "loading" : (userId ?? "locked")}</span>
      <button
        onClick={async () => {
          try {
            if (userId) await create({ userId, name: "Offline edit", status: "idea" });
          } catch (error) {
            setError(error instanceof Error ? error.name : String(error));
          }
        }}
      >
        Create
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
function App() {
  return (
    <AuthGate>
      <SyncWorkerProvider>
        <AccountView />
      </SyncWorkerProvider>
    </AuthGate>
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  state.identity = undefined;
  state.online = false;
  state.session = null;
  state.pending = false;
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => state.online);
  for (const subject of ["A", "B"]) {
    const store = new InMemoryLocalStore();
    await store.putEntityRow({
      table: "builds",
      id: subject,
      userId: subject,
      json: JSON.stringify({ _id: subject, userId: subject, name: subject }),
      updatedAt: 1,
      deleted: false,
      synced: true,
    });
    await store.enqueueMutation({
      fn: "builds:create",
      argsJson: "{}",
      idempotencyKey: subject,
      clientId: null,
    });
    state.stores.set(subject, store);
  }
});
afterEach(() => {
  vi.restoreAllMocks();
  offlineRuntime.lock();
});

it("requires sign-in when no account has previously signed in on this device", async () => {
  render(<App />);
  await waitFor(() => expect(state.redirect).toHaveBeenCalledWith("/auth/signin"));
  expect(offlineRuntime.getSubject()).toBeNull();
  expect(readLocalCollections().builds).toEqual([]);
});

it("opens the remembered vault on an offline cold launch without authenticating or syncing", async () => {
  rememberLocalAccount("A");
  const view = render(<App />);
  await waitFor(() => expect(offlineRuntime.getSubject()).toBe("A"));
  expect(screen.getByText("A")).toBeInTheDocument();
  expect(readLocalCollections("A").builds.map((row) => row.id)).toEqual(["A"]);
  // Reading works offline; personal writes are refused on web (ADR-0005), visibly and locally.
  const alert = vi.spyOn(window, "alert").mockImplementation(() => undefined);
  fireEvent.click(screen.getByText("Create"));
  expect(await screen.findByRole("alert")).toHaveTextContent("PublishedReadOnlyError");
  expect(alert).toHaveBeenCalledOnce();
  expect(readLocalCollections("A").builds).toHaveLength(1);
  expect(state.redirect).not.toHaveBeenCalled();
  expect(state.mutation).not.toHaveBeenCalled();
  expect(state.query).not.toHaveBeenCalled();
  state.identity = null;
  view.rerender(<App />);
  expect(offlineRuntime.getSubject()).toBe("A");
  view.unmount();
  render(<App />);
  await waitFor(() => expect(offlineRuntime.getSubject()).toBe("A"));
  expect(readLocalAccount()).toBe("A");
});

it("remembers sign-in, waits for confirmed auth, switches accounts, and honors explicit sign-out", async () => {
  state.online = true;
  state.identity = { subject: "A" };
  const view = render(<App />);
  await waitFor(() => expect(readLocalAccount()).toBe("A"));
  await waitFor(() => expect(offlineRuntime.getSubject()).toBe("A"));
  state.identity = undefined;
  view.rerender(<App />);
  expect(offlineRuntime.getSubject()).toBe("A");
  state.identity = { subject: "B" };
  view.rerender(<App />);
  await waitFor(() => expect(offlineRuntime.getSubject()).toBe("B"));
  expect(readLocalCollections("B").builds.map((row) => row.id)).toEqual(["B"]);
  expect(readLocalCollections("A").builds).toEqual([]);
  act(() => {
    rememberLocalAccount(null);
    offlineRuntime.lock();
  });
  expect(readLocalAccount()).toBeNull();
  expect(offlineRuntime.getSubject()).toBeNull();
  view.rerender(<App />);
  expect(offlineRuntime.getSubject()).toBeNull();
});

it("does not treat an unavailable Convex credential as a confirmed session sign-out", async () => {
  rememberLocalAccount("A");
  state.online = true;
  state.identity = null;
  state.session = {};
  const view = render(<App />);
  await waitFor(() => expect(offlineRuntime.getSubject()).toBe("A"));
  expect(readLocalAccount()).toBe("A");
  expect(state.query).not.toHaveBeenCalled();
  state.session = null;
  state.pending = true;
  view.rerender(<App />);
  expect(offlineRuntime.getSubject()).toBe("A");
  state.pending = false;
  view.rerender(<App />);
  await waitFor(() => expect(offlineRuntime.getSubject()).toBeNull());
});

it("locks and forgets the account only after an online confirmed absent session", async () => {
  rememberLocalAccount("A");
  const view = render(<App />);
  await waitFor(() => expect(offlineRuntime.getSubject()).toBe("A"));
  act(() => {
    state.online = true;
    window.dispatchEvent(new Event("online"));
  });
  expect(offlineRuntime.getSubject()).toBe("A");
  state.identity = null;
  view.rerender(<App />);
  await waitFor(() => expect(offlineRuntime.getSubject()).toBeNull());
  expect(readLocalAccount()).toBeNull();
  expect(state.redirect).toHaveBeenCalledWith("/auth/signin");
});
