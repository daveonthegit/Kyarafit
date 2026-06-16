/**
 * Tiny reactive store backing optimistic visibility. Offline writes (and the sync worker clearing
 * them after a successful drain) bump a version; `useOfflineQuery` subscribes via
 * `useSyncExternalStore` so registered list/detail queries re-read pending `entity_rows` overlays
 * and repaint immediately — even when the write happens on the same screen.
 */

let version = 0;
const listeners = new Set<() => void>();

export function getOverlayVersion(): number {
  return version;
}

export function bumpOverlayVersion(): void {
  version += 1;
  for (const listener of listeners) listener();
}

export function subscribeOverlay(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
