import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { RestoreReadOnlyNotice } from "./RestoreReadOnlyNotice";
import { OfflineRuntime, offlineRuntime } from "@/lib/offline/runtime";
import { InMemoryLocalStore } from "@/lib/offline/localStore";
import { RESTORE_SESSION_KEY } from "@/lib/offline/restoreState";

vi.mock("next-intl", () => ({
  useTranslations: () => () => "Finish or undo your restore first.",
}));

class TabChannel {
  static channels = new Set<TabChannel>();
  onmessage: ((event: MessageEvent) => void) | null = null;
  constructor(readonly name: string) {
    TabChannel.channels.add(this);
  }
  postMessage(data: unknown) {
    for (const channel of TabChannel.channels) {
      if (channel !== this && channel.name === this.name) {
        channel.onmessage?.(new MessageEvent("message", { data }));
      }
    }
  }
  close() {
    TabChannel.channels.delete(this);
  }
}

afterEach(() => {
  offlineRuntime.lock();
  TabChannel.channels.clear();
  vi.unstubAllGlobals();
});

describe("restore read-only notice across tabs", () => {
  it("updates another open tab when the durable restore session starts and ends", async () => {
    vi.stubGlobal("BroadcastChannel", TabChannel);
    const store = new InMemoryLocalStore();
    const tabA = new OfflineRuntime();
    tabA.setStore(store, "owner");
    offlineRuntime.setStore(store, "owner");
    await Promise.all([tabA.hydrate(), offlineRuntime.hydrate()]);
    render(<RestoreReadOnlyNotice />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await act(async () => {
      await tabA.setMeta(RESTORE_SESSION_KEY, JSON.stringify({ id: "restore", created: [] }));
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Finish or undo your restore first.");
    await act(async () => tabA.setMeta(RESTORE_SESSION_KEY, ""));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    tabA.lock();
  });
});
