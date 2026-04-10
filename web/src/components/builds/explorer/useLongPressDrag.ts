"use client";

import { useCallback, useRef } from "react";
import type { NodeSelectionMeta } from "./types";

const LONG_PRESS_MS = 300;

type UseLongPressDragOpts = {
  meta: NodeSelectionMeta;
  onDragStart: (meta: NodeSelectionMeta, x: number, y: number) => void;
  enabled?: boolean;
};

/**
 * Returns pointer-event handlers that detect a long-press (300ms) on
 * touch devices and fire the drag-start callback. If the user lifts
 * or moves their finger before the threshold, nothing happens.
 */
export function useLongPressDrag({ meta, onDragStart, enabled = true }: UseLongPressDragOpts) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPos.current = null;
    firedRef.current = false;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || e.pointerType !== "touch" || e.button !== 0) return;
      startPos.current = { x: e.clientX, y: e.clientY };
      firedRef.current = false;

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (!startPos.current) return;
        firedRef.current = true;
        // Haptic feedback if available
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(20);
        }
        onDragStart(meta, startPos.current.x, startPos.current.y);
      }, LONG_PRESS_MS);
    },
    [enabled, meta, onDragStart]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startPos.current || firedRef.current) return;
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        clear();
      }
    },
    [clear]
  );

  const onPointerUp = useCallback(() => {
    clear();
  }, [clear]);

  const onPointerCancel = useCallback(() => {
    clear();
  }, [clear]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
