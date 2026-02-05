/**
 * Builds API client. All requests send x-kyar-device-id.
 * When signed in, sends Authorization for tier/limits and web access.
 */

import type {
  Build,
  BuildTask,
  CreateBuildInput,
  CreateBuildTaskInput,
  UpdateBuildInput,
  UpdateBuildTaskInput,
} from "@kyarafit/design-system/types";
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

export async function fetchBuilds(): Promise<Build[]> {
  const res = await fetch(`${API_URL}/builds`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to fetch builds");
  const data = await res.json();
  return data.builds ?? [];
}

export async function createBuild(input: CreateBuildInput): Promise<Build> {
  const res = await fetch(`${API_URL}/builds`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create build");
  }
  return res.json();
}

export async function fetchBuild(id: string): Promise<Build | null> {
  const res = await fetch(`${API_URL}/builds/${id}`, { headers: headers() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch build");
  return res.json();
}

export async function updateBuild(id: string, input: UpdateBuildInput): Promise<Build> {
  const res = await fetch(`${API_URL}/builds/${id}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update build");
  }
  return res.json();
}

export async function fetchBuildItems(id: string): Promise<string[]> {
  const res = await fetch(`${API_URL}/builds/${id}/items`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to fetch build items");
  const data = await res.json();
  return data.closetItemIds ?? [];
}

export async function linkBuildItems(id: string, closetItemIds: string[]): Promise<void> {
  const res = await fetch(`${API_URL}/builds/${id}/items`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ closetItemIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to link items");
  }
}

export async function fetchBuildTasks(buildId: string): Promise<BuildTask[]> {
  const res = await fetch(`${API_URL}/builds/${buildId}/tasks`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to fetch build tasks");
  const data = await res.json();
  return data.tasks ?? [];
}

export async function createBuildTask(
  buildId: string,
  input: CreateBuildTaskInput
): Promise<BuildTask> {
  const res = await fetch(`${API_URL}/builds/${buildId}/tasks`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create task");
  }
  return res.json();
}

export async function updateBuildTask(
  buildId: string,
  taskId: string,
  input: UpdateBuildTaskInput
): Promise<BuildTask> {
  const res = await fetch(`${API_URL}/builds/${buildId}/tasks/${taskId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update task");
  }
  return res.json();
}

export async function deleteBuildTask(buildId: string, taskId: string): Promise<void> {
  const res = await fetch(`${API_URL}/builds/${buildId}/tasks/${taskId}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to delete task");
  }
}
