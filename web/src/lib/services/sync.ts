/**
 * Web sync service: bidirectional sync with backend
 * FREE tier: No sync (local-only)
 * PREMIUM_BASIC+: Full bidirectional sync
 */

import * as outbox from "../storage/outboxRepo";
import * as buildsRepo from "../storage/buildsRepo";
import { getValue, setValue } from "../storage/db";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr";

  let deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    deviceId = "web-" + Math.random().toString(36).slice(2, 12);
    localStorage.setItem("deviceId", deviceId);
  }
  return deviceId;
}

async function request<T>(
  method: string,
  path: string,
  body: unknown | undefined,
  token: string | null
): Promise<{ ok: boolean; data?: T; status?: number }> {
  const deviceId = getDeviceId();
  const url = `${API_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-kyar-device-id": deviceId,
    "x-kyar-client": "web",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      return { ok: false, status: res.status };
    }
    const data =
      res.status === 204 || res.headers.get("content-length") === "0"
        ? undefined
        : await res.json();
    return { ok: true, data: data as T };
  } catch {
    return { ok: false };
  }
}

export interface SyncResult {
  pushed: number;
  failed: number;
  pulled: number;
  error?: string;
}

/**
 * Run bidirectional sync
 * 1. Push phase: flush outbox to backend
 * 2. Pull phase: fetch server changes and merge into IndexedDB
 */
export async function runSync(token: string | null, canSync: boolean): Promise<SyncResult> {
  if (!token || !canSync) {
    return { pushed: 0, failed: 0, pulled: 0, error: "Sync requires Premium Basic or higher" };
  }

  // ==================== PUSH PHASE ====================
  const pending = await outbox.listPending();
  let pushed = 0;
  let failed = 0;

  for (const entry of pending) {
    let ok = false;

    if (entry.type === "build.upsert") {
      const payload = entry.payload as { build: any };
      const b = payload.build;
      const result = await request(
        "POST",
        "/builds",
        {
          id: b.id,
          name: b.name,
          character: b.character,
          status: b.status,
          notes: b.notes,
          imageUrl: b.imageUrl,
          budgetCents: b.budgetCents,
        },
        token
      );
      ok = result.ok;
    } else if (entry.type === "build.delete") {
      const payload = entry.payload as { id: string };
      const result = await request("DELETE", `/builds/${payload.id}`, undefined, token);
      ok = result.ok || result.status === 404;
    }
    // TODO: Add more entry types (closet, conventions, tasks, etc.)

    if (ok) {
      await outbox.remove(entry.id);
      pushed++;
    } else {
      failed++;
    }
  }

  // ==================== PULL PHASE ====================
  let pulled = 0;

  try {
    const lastSync = await getValue("last_sync_timestamp");
    const sinceParam = lastSync ? `?since=${encodeURIComponent(lastSync)}` : "";

    const pullResult = await request<{
      closetItems: Array<any>;
      builds: Array<any>;
      buildTasks: Array<any>;
      conventions: Array<any>;
      serverTimestamp: string;
    }>("GET", `/api/v1/sync/pull${sinceParam}`, undefined, token);

    if (pullResult.ok && pullResult.data) {
      const data = pullResult.data;

      // Merge builds
      for (const serverBuild of data.builds) {
        if (serverBuild.deleted) {
          await buildsRepo.deleteBuild(serverBuild.id, false); // Don't re-enqueue
          pulled++;
        } else {
          const localBuild = await buildsRepo.getById(serverBuild.id);
          if (!localBuild || new Date(serverBuild.updatedAt) > new Date(localBuild.updatedAt)) {
            await buildsRepo.upsertFromSync(serverBuild);
            pulled++;
          }
        }
      }

      // TODO: Merge other entities (closet, conventions, tasks, etc.)

      // Update last sync timestamp
      await setValue("last_sync_timestamp", data.serverTimestamp);
    }
  } catch (error) {
    console.error("Pull sync error:", error);
    // Don't fail the entire sync if pull fails
  }

  return { pushed, failed, pulled };
}

export async function getSyncPendingCount(): Promise<number> {
  const pending = await outbox.listPending();
  return pending.length;
}

// Trigger sync on app load (if enabled)
export function setupSyncTriggers(token: string | null, canSync: boolean) {
  if (typeof window === "undefined") return;

  // Initial sync on load
  if (token && canSync) {
    runSync(token, canSync).catch(console.error);
  }

  // Sync when window regains focus
  window.addEventListener("focus", () => {
    if (token && canSync) {
      runSync(token, canSync).catch(console.error);
    }
  });

  // Sync before page unload (best effort)
  window.addEventListener("beforeunload", () => {
    if (token && canSync) {
      // Fire-and-forget, may not complete
      runSync(token, canSync).catch(console.error);
    }
  });
}
