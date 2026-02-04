/**
 * Sync service: flush outbox to backend when online.
 * Run on app launch and when app becomes active.
 */

import type { ClosetItem } from '@kyarafit/design-system/types';
import * as outbox from '../storage/outboxRepo';

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
  body?: unknown
): Promise<{ ok: boolean; data?: T; status?: number }> {
  const deviceId = getDeviceId();
  const url = `${API_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-kyar-device-id': deviceId,
  };
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

export async function runSync(): Promise<{ synced: number; failed: number }> {
  const pending = await outbox.listPending();
  let synced = 0;
  let failed = 0;

  for (const entry of pending) {
    if (entry.type === 'upsert') {
      const payload = entry.payload as { item: ClosetItem };
      const item = payload.item;
      const body = {
        name: item.name,
        category: item.category,
        tags: item.tags ?? [],
        notes: item.notes ?? undefined,
        imageUrl: item.imageUrl ?? undefined,
      };
      const result = await request<ClosetItem>('POST', '/closet/items', body);
      if (result.ok) {
        await outbox.remove(entry.id);
        synced++;
      } else {
        failed++;
      }
    } else if (entry.type === 'delete') {
      const payload = entry.payload as { id: string };
      const result = await request('DELETE', `/closet/items/${payload.id}`);
      if (result.ok || result.status === 404) {
        await outbox.remove(entry.id);
        synced++;
      } else {
        failed++;
      }
    }
  }

  return { synced, failed };
}

export async function getSyncPendingCount(): Promise<number> {
  const pending = await outbox.listPending();
  return pending.length;
}
