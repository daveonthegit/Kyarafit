/**
 * Sync service: bidirectional sync with backend.
 * Push phase: flush outbox to backend when online.
 * Pull phase: fetch server changes and merge into local DB.
 * Run on app launch and when app becomes active.
 * Anonymous users: no sync attempts (local-only).
 * Logged-in FREE: backend returns 403 (upgrade for backup).
 * PREMIUM_BASIC+: full bidirectional sync. Pass token from session when calling runSync.
 */

import type { ClosetItem } from '@kyarafit/design-system/types';
import * as outbox from '../storage/outboxRepo';
import * as closetRepo from '../storage/closetRepo';
import * as buildsRepo from '../storage/buildsRepo';
import * as buildTasksRepo from '../storage/buildTasksRepo';
import * as conventionsRepo from '../storage/conventionsRepo';
import { getValue, setValue } from '../storage/db';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

declare let global: { __kyarDeviceId?: string };

function getDeviceId(): string {
  if (typeof global !== 'undefined' && global.__kyarDeviceId) {
    return global.__kyarDeviceId;
  }
  return 'dev-' + Math.random().toString(36).slice(2, 12);
}

export function setDeviceId(id: string): void {
  if (typeof global !== 'undefined') global.__kyarDeviceId = id;
}

export function getDeviceIdForSync(): string {
  return getDeviceId();
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
    'Content-Type': 'application/json',
    'x-kyar-device-id': deviceId,
    'x-kyar-client': 'mobile',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
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
    const data = (res.status === 204 || res.headers.get('content-length') === '0')
      ? undefined
      : await res.json();
    return { ok: true, data: data as T };
  } catch {
    return { ok: false };
  }
}

/**
 * Run bidirectional sync.
 * 1. Push phase: flush outbox to backend
 * 2. Pull phase: fetch server changes and merge into local DB
 * Pass token from session when user is signed in; backend requires PREMIUM_BASIC+ for mobile sync.
 * When token is null (anonymous), no backend requests are made (local-only).
 */
export async function runSync(token: string | null): Promise<{ pushed: number; failed: number; pulled: number }> {
  if (token == null) {
    return { pushed: 0, failed: 0, pulled: 0 };
  }

  // ==================== PUSH PHASE ====================
  const pending = await outbox.listPending();
  let pushed = 0;
  let failed = 0;

  for (const entry of pending) {
    let ok = false;
    if (entry.type === 'upsert') {
      const payload = entry.payload as { item: ClosetItem };
      const item = payload.item;
      const body = {
        name: item.name,
        category: item.category,
        tags: item.tags ?? [],
        notes: item.notes ?? undefined,
        imageUrl: item.imageUrl ?? undefined,
        costCents: item.costCents ?? undefined,
      };
      const result = await request<ClosetItem>('POST', '/closet/items', body, token);
      ok = result.ok;
    } else if (entry.type === 'delete') {
      const payload = entry.payload as { id: string };
      const result = await request('DELETE', `/closet/items/${payload.id}`, undefined, token);
      ok = result.ok || result.status === 404;
    } else if (entry.type === 'build.upsert') {
      const payload = entry.payload as { build: { id: string; name: string; character?: string; status: string; notes?: string; imageUrl?: string; budgetCents?: number } };
      const b = payload.build;
      const result = await request('POST', '/builds', {
        id: b.id,
        name: b.name,
        character: b.character,
        status: b.status,
        notes: b.notes,
        imageUrl: b.imageUrl,
        budgetCents: b.budgetCents,
      }, token);
      ok = result.ok;
    } else if (entry.type === 'build.task.upsert') {
      const payload = entry.payload as { task: { id: string; buildId: string; label: string; closetItemId?: string | null; sortOrder: number } };
      const t = payload.task;
      const result = await request('POST', `/builds/${t.buildId}/tasks`, {
        id: t.id,
        label: t.label,
        closetItemId: t.closetItemId ?? undefined,
        sortOrder: t.sortOrder,
      }, token);
      ok = result.ok;
    } else if (entry.type === 'build.task.delete') {
      const payload = entry.payload as { taskId: string; buildId: string };
      const result = await request('DELETE', `/builds/${payload.buildId}/tasks/${payload.taskId}`, undefined, token);
      ok = result.ok || result.status === 404;
    } else if (entry.type === 'build.linkItems') {
      const payload = entry.payload as { buildId: string; closetItemIds: string[] };
      const result = await request('POST', `/builds/${payload.buildId}/items`, { closetItemIds: payload.closetItemIds }, token);
      ok = result.ok;
    } else if (entry.type === 'convention.upsert') {
      const payload = entry.payload as { convention: { id: string; name: string; location?: string; startDate: string; endDate: string } };
      const c = payload.convention;
      const result = await request('POST', '/conventions', {
        id: c.id,
        name: c.name,
        location: c.location,
        startDate: c.startDate,
        endDate: c.endDate,
      }, token);
      ok = result.ok;
    } else if (entry.type === 'convention.plan.replace') {
      const payload = entry.payload as { conventionId: string; plan: { date: string; buildId: string | null; notes?: string }[] };
      const result = await request('PUT', `/conventions/${payload.conventionId}/plan`, { plan: payload.plan }, token);
      ok = result.ok;
    } else if (entry.type === 'packing.toggle') {
      const payload = entry.payload as { packingItemId: string; checked: boolean };
      const result = await request('PATCH', `/packing/${payload.packingItemId}`, { checked: payload.checked }, token);
      ok = result.ok;
    } else if (entry.type === 'packing.addManual') {
      const payload = entry.payload as { conventionId: string; item: { label: string; date?: string | null; buildId?: string | null } };
      const result = await request('POST', `/conventions/${payload.conventionId}/packing/manual`, {
        label: payload.item.label,
        date: payload.item.date ?? undefined,
        buildId: payload.item.buildId ?? undefined,
      }, token);
      ok = result.ok;
    } else if (entry.type === 'packing.regenerate') {
      const payload = entry.payload as { conventionId: string };
      const result = await request('POST', `/conventions/${payload.conventionId}/packing/regenerate`, undefined, token);
      ok = result.ok;
    }
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
    // Get last sync timestamp
    const lastSync = await getValue('last_sync_timestamp');
    const sinceParam = lastSync ? `?since=${encodeURIComponent(lastSync)}` : '';
    
    // Fetch server changes
    const pullResult = await request<{
      closetItems: Array<any>;
      builds: Array<any>;
      buildTasks: Array<any>;
      conventions: Array<any>;
      conventionPlans: Array<any>;
      packingListItems: Array<any>;
      serverTimestamp: string;
    }>('GET', `/api/v1/sync/pull${sinceParam}`, undefined, token);

    if (pullResult.ok && pullResult.data) {
      const data = pullResult.data;

      // Merge closet items (last-write-wins based on updatedAt)
      for (const serverItem of data.closetItems) {
        if (serverItem.deleted) {
          await closetRepo.deleteItem(serverItem.id);
          pulled++;
        } else {
          const localItem = await closetRepo.getById(serverItem.id);
          if (!localItem || new Date(serverItem.updatedAt) > new Date(localItem.updatedAt)) {
            // Server version is newer or item doesn't exist locally
            await closetRepo.upsertFromSync({
              id: serverItem.id,
              name: serverItem.name,
              category: serverItem.category,
              imageUrl: serverItem.imageUrl,
              notes: serverItem.notes,
              tags: [],
              costCents: null,
              createdAt: serverItem.createdAt,
              updatedAt: serverItem.updatedAt,
            });
            pulled++;
          }
        }
      }

      // Merge builds
      for (const serverBuild of data.builds) {
        if (serverBuild.deleted) {
          await buildsRepo.deleteBuild(serverBuild.id);
          pulled++;
        } else {
          const localBuild = await buildsRepo.getById(serverBuild.id);
          if (!localBuild || new Date(serverBuild.updatedAt) > new Date(localBuild.updatedAt)) {
            await buildsRepo.upsertFromSync({
              id: serverBuild.id,
              name: serverBuild.name,
              character: serverBuild.character,
              status: serverBuild.status,
              notes: serverBuild.notes,
              imageUrl: serverBuild.imageUrl,
              budgetCents: serverBuild.budgetCents,
              createdAt: serverBuild.createdAt,
              updatedAt: serverBuild.updatedAt,
            });
            pulled++;
          }
        }
      }

      // Merge build tasks
      for (const serverTask of data.buildTasks) {
        if (serverTask.deleted) {
          await buildTasksRepo.deleteTask(serverTask.id);
          pulled++;
        } else {
          const localTask = await buildTasksRepo.getById(serverTask.id);
          if (!localTask || new Date(serverTask.updatedAt) > new Date(localTask.updatedAt)) {
            await buildTasksRepo.upsertFromSync({
              id: serverTask.id,
              buildId: serverTask.buildId,
              label: serverTask.label,
              closetItemId: serverTask.closetItemId,
              sortOrder: serverTask.sortOrder,
              checked: serverTask.checked,
              createdAt: serverTask.createdAt,
              updatedAt: serverTask.updatedAt,
            });
            pulled++;
          }
        }
      }

      // Merge conventions
      for (const serverConv of data.conventions) {
        if (serverConv.deleted) {
          await conventionsRepo.deleteConvention(serverConv.id);
          pulled++;
        } else {
          const localConv = await conventionsRepo.getById(serverConv.id);
          if (!localConv || new Date(serverConv.updatedAt) > new Date(localConv.updatedAt)) {
            await conventionsRepo.upsertFromSync({
              id: serverConv.id,
              name: serverConv.name,
              location: serverConv.location,
              imageUrl: serverConv.imageUrl,
              startDate: serverConv.startDate,
              endDate: serverConv.endDate,
              createdAt: serverConv.createdAt,
              updatedAt: serverConv.updatedAt,
            });
            pulled++;
          }
        }
      }

      // TODO: Merge convention plans and packing list items if repos support it

      // Update last sync timestamp
      await setValue('last_sync_timestamp', data.serverTimestamp);
    }
  } catch (error) {
    console.error('Pull sync error:', error);
    // Don't fail the entire sync if pull fails
  }

  return { pushed, failed, pulled };
}

export async function getSyncPendingCount(): Promise<number> {
  const pending = await outbox.listPending();
  return pending.length;
}
