/**
 * Conventions API client. All requests send x-kyar-device-id.
 * When signed in, sends Authorization and x-kyar-client: web for tier/limits.
 */

import type {
  Convention,
  CreateConventionInput,
  UpdateConventionInput,
  ConventionDayPlan,
  DayPlanEntry,
  PackingListItem,
  AddManualPackingItemInput,
  UpdatePackingItemInput,
} from '@kyarafit/design-system/types';
import { getToken } from '../auth/client';
import { getOrCreateDeviceId } from '../deviceId';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

function headers(): HeadersInit {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    'x-kyar-device-id': getOrCreateDeviceId(),
    'x-kyar-client': 'web',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchConventions(): Promise<Convention[]> {
  const res = await fetch(`${API_URL}/conventions`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to fetch conventions');
  const data = await res.json();
  return data.conventions ?? [];
}

export async function createConvention(input: CreateConventionInput): Promise<Convention> {
  const res = await fetch(`${API_URL}/conventions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create convention');
  }
  return res.json();
}

export async function fetchConvention(id: string): Promise<Convention | null> {
  const res = await fetch(`${API_URL}/conventions/${id}`, { headers: headers() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch convention');
  return res.json();
}

export async function updateConvention(id: string, input: UpdateConventionInput): Promise<Convention> {
  const res = await fetch(`${API_URL}/conventions/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update convention');
  }
  return res.json();
}

export async function fetchPlan(conventionId: string): Promise<ConventionDayPlan[]> {
  const res = await fetch(`${API_URL}/conventions/${conventionId}/plan`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to fetch plan');
  const data = await res.json();
  return data.plan ?? [];
}

export async function replacePlan(conventionId: string, plan: DayPlanEntry[]): Promise<ConventionDayPlan[]> {
  const res = await fetch(`${API_URL}/conventions/${conventionId}/plan`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update plan');
  }
  const data = await res.json();
  return data.plan ?? [];
}

export async function fetchPacking(conventionId: string): Promise<PackingListItem[]> {
  const res = await fetch(`${API_URL}/conventions/${conventionId}/packing`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to fetch packing list');
  const data = await res.json();
  return data.items ?? [];
}

export async function regeneratePacking(conventionId: string): Promise<PackingListItem[]> {
  const res = await fetch(`${API_URL}/conventions/${conventionId}/packing/regenerate`, {
    method: 'POST',
    headers: headers(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to regenerate packing list');
  }
  const data = await res.json();
  return data.items ?? [];
}

export async function updatePackingItem(packingItemId: string, input: UpdatePackingItemInput): Promise<PackingListItem> {
  const res = await fetch(`${API_URL}/packing/${packingItemId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update packing item');
  }
  return res.json();
}

export async function addManualPackingItem(
  conventionId: string,
  input: AddManualPackingItemInput
): Promise<PackingListItem> {
  const res = await fetch(`${API_URL}/conventions/${conventionId}/packing/manual`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add manual item');
  }
  return res.json();
}
