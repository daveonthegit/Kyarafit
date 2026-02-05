/**
 * Get or create a persistent device id (no auth yet).
 */

import { get, set } from "../storage";

const KEY = "kyar_device_id";

function generateId(): string {
  return "dev-" + Math.random().toString(36).slice(2, 14) + "-" + Date.now().toString(36);
}

export async function getOrCreateDeviceId(): Promise<string> {
  let id = await get(KEY);
  if (!id) {
    id = generateId();
    await set(KEY, id);
  }
  return id;
}
