/**
 * Get or create a persistent device id (no auth yet).
 * Stored in localStorage, sent as x-kyar-device-id on API requests.
 */

const KEY = "kyar_device_id";

function generateId(): string {
  return "dev-" + Math.random().toString(36).slice(2, 14) + "-" + Date.now().toString(36);
}

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return generateId();
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = generateId();
    localStorage.setItem(KEY, id);
  }
  return id;
}
