import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { __setActiveVaultForTests } from "@/vault/activeVault";
import { Replicator } from "@/vault/replica/replicator";
import { makeTestVault } from "@/test-support/vaultHarness";
import { ChangesNotAppliedScreen } from "../ChangesNotAppliedScreen";

const h = vi.hoisted(() => ({ push: vi.fn(), alert: vi.fn() }));

vi.mock("react-native", async () => {
  const { createReactNativeMock } = await import("@/test-support/rnMock");
  return { ...(await createReactNativeMock()), Alert: { alert: h.alert } };
});
vi.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: h.push }),
}));
vi.mock("convex/react", () => ({ useQuery: () => undefined, useConvex: () => ({}) }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.name ? `${key}:${String(options.name)}` : key,
    i18n: { language: "en" },
  }),
}));

function setup() {
  const vault = makeTestVault();
  const replicator = new Replicator(vault.sql, { newOpId: () => crypto.randomUUID() });
  const build = vault.mutate<{ _id: string }>("builds:create", { name: "Zelda (TotK)" });
  const conflict = (id: string, kind: string, rowId: string, lost: Record<string, unknown>) =>
    vault.sql.runSync(
      `INSERT INTO replica_conflicts (id, table_name, row_id, kind, lost_json, build_id, rev, created_at)
       VALUES (?, 'builds', ?, ?, ?, ?, 1, 1)`,
      [id, rowId, kind, JSON.stringify(lost), rowId]
    );
  act(() => __setActiveVaultForTests(vault.store, undefined, { replicator, sql: vault.sql }));
  return { vault, build, conflict };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  act(() => __setActiveVaultForTests(null));
});

describe("ChangesNotAppliedScreen", () => {
  it("shows an empty state when every change applied", () => {
    setup();
    render(<ChangesNotAppliedScreen />);
    expect(screen.getByText("sync.changes.emptyTitle")).toBeTruthy();
  });

  it("restores an overwritten value as a new edit with one tap", () => {
    const { vault, build, conflict } = setup();
    conflict("c1", "concurrent-field-edit", build._id, { name: "Zelda (BotW)" });
    render(<ChangesNotAppliedScreen buildId={build._id} />);
    expect(screen.getByText("sync.changes.introBuild:Zelda (TotK)")).toBeTruthy();
    expect(screen.getByText("sync.changes.kind.concurrent")).toBeTruthy();
    expect(screen.getByText(/Zelda \(BotW\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "sync.changes.useMine" }));
    expect(vault.store.reader().get(build._id)?.name).toBe("Zelda (BotW)");
    expect(screen.getByText("sync.changes.emptyTitle")).toBeTruthy();
    expect(
      vault.sql.getFirstSync(
        "SELECT resolved, dismiss_pending FROM replica_conflicts WHERE id = 'c1'"
      )
    ).toEqual({ resolved: 1, dismiss_pending: 1 });
  });

  it("explains a change that can't come back and lets the user dismiss it", () => {
    const { vault, build, conflict } = setup();
    conflict("c2", "concurrent-field-edit", "local:gone", { name: "Deleted elsewhere" });
    conflict("c3", "orphan-recovered", build._id, { buildId: "local:old" });
    render(<ChangesNotAppliedScreen />);
    expect(screen.getByText("sync.changes.goneItem")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "sync.changes.useMine" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "sync.changes.dismiss" }));
    fireEvent.click(screen.getByRole("button", { name: "sync.changes.openBuild" }));
    expect(h.push).toHaveBeenCalledWith(`/(app)/b/${build._id}`);
    fireEvent.click(screen.getByRole("button", { name: "sync.changes.acknowledge" }));
    expect(screen.getByText("sync.changes.emptyTitle")).toBeTruthy();
    expect(vault.sql.getAllSync("SELECT id FROM replica_conflicts WHERE resolved = 0")).toEqual([]);
  });
});
