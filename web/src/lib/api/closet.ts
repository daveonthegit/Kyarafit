/**
 * Closet API client. All requests send x-kyar-device-id.
 * When signed in, sends Authorization and x-kyar-client: web for tier/limits.
 */

import type { ClosetItem, CreateClosetItemInput } from "@kyarafit/design-system/types";
import { getToken } from "../auth/client";
import { getOrCreateDeviceId } from "../deviceId";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

function headers(): HeadersInit {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    "x-kyar-device-id": getOrCreateDeviceId(),
    "x-kyar-client": "web",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchClosetItems(): Promise<ClosetItem[]> {
  const res = await fetch(`${API_URL}/closet/items`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to fetch closet items");
  const data = await res.json();
  return data.items ?? [];
}

export async function createClosetItem(input: CreateClosetItemInput): Promise<ClosetItem> {
  const res = await fetch(`${API_URL}/closet/items`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create item");
  }
  return res.json();
}
