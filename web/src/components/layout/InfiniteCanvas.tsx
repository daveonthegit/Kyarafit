"use client";

import { useRef, useCallback, useEffect } from "react";
import { gsap } from "gsap";

const WHEEL_SMOOTH = 0.08;
const DRAG_SMOOTH = 1;
const INERTIA_DECAY = 0.92;
const MIN_VELOCITY = 0.5;
const BOUNDS_PADDING = 80;
const DRAG_THRESHOLD_PX = 8;

export interface InfiniteCanvasProps {
  children: React.ReactNode;
  className?: string;
  /** Grid class for the inner content (e.g. grid-cols-2 gap-6 lg:grid-cols-4) */
  gridClassName?: string;
}

/**
 * Infinite canvas: seamless scrolling grid with smooth GSAP animations.
 * Supports mouse wheel, touch, and pointer drag for panning.
 */
export function InfiniteCanvas({
  children,
  className = "",
  gridClassName = "grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4",
}: InfiniteCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const position = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const lastPointer = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const didDrag = useRef(false);
  const rafId = useRef<number | null>(null);
  const inertiaRaf = useRef<number | null>(null);

  const applyBounds = useCallback((x: number, y: number) => {
    const vp = viewportRef.current;
    const content = contentRef.current;
    if (!vp || !content) return { x, y };

    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    const cw = content.scrollWidth;
    const ch = content.scrollHeight;
    const pad = BOUNDS_PADDING;

    const minX = vw - cw - pad;
    const maxX = pad;
    const minY = vh - ch - pad;
    const maxY = pad;

    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y)),
    };
  }, []);

  const renderPosition = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    gsap.set(content, {
      x: position.current.x,
      y: position.current.y,
      force3D: true,
    });
  }, []);

  const tickInertia = useCallback(() => {
    const content = contentRef.current;
    const vp = viewportRef.current;
    if (!content || !vp) return;

    let vx = velocity.current.x;
    let vy = velocity.current.y;
    if (Math.abs(vx) < MIN_VELOCITY && Math.abs(vy) < MIN_VELOCITY) {
      velocity.current.x = 0;
      velocity.current.y = 0;
      return;
    }

    const bounded = applyBounds(position.current.x + vx, position.current.y + vy);
    position.current.x = bounded.x;
    position.current.y = bounded.y;
    velocity.current.x = vx * INERTIA_DECAY;
    velocity.current.y = vy * INERTIA_DECAY;
    renderPosition();
    inertiaRaf.current = requestAnimationFrame(tickInertia);
  }, [applyBounds, renderPosition]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!viewportRef.current) return;
    (viewportRef.current as HTMLElement).setPointerCapture(e.pointerId);
    isDragging.current = true;
    didDrag.current = false;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    velocity.current = { x: 0, y: 0 };
    if (inertiaRaf.current != null) {
      cancelAnimationFrame(inertiaRaf.current);
      inertiaRaf.current = null;
    }
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
        didDrag.current = true;
      }
      lastPointer.current = { x: e.clientX, y: e.clientY };
      velocity.current = { x: dx * DRAG_SMOOTH, y: dy * DRAG_SMOOTH };
      const bounded = applyBounds(position.current.x + dx, position.current.y + dy);
      position.current.x = bounded.x;
      position.current.y = bounded.y;
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        renderPosition();
        rafId.current = null;
      });
    },
    [applyBounds, renderPosition]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!viewportRef.current) return;
      (viewportRef.current as HTMLElement).releasePointerCapture(e.pointerId);
      isDragging.current = false;
      if (inertiaRaf.current == null) {
        inertiaRaf.current = requestAnimationFrame(tickInertia);
      }
    },
    [tickInertia]
  );

  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const dx = -e.deltaX * WHEEL_SMOOTH;
      const dy = -e.deltaY * WHEEL_SMOOTH;
      const bounded = applyBounds(position.current.x + dx, position.current.y + dy);
      position.current.x = bounded.x;
      position.current.y = bounded.y;
      gsap.to(contentRef.current, {
        x: position.current.x,
        y: position.current.y,
        duration: 0.25,
        ease: "power2.out",
        overwrite: true,
        force3D: true,
      });
    },
    [applyBounds]
  );

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onCaptureClick = (e: MouseEvent) => {
      if (didDrag.current) {
        e.preventDefault();
        e.stopPropagation();
        didDrag.current = false;
      }
    };
    vp.addEventListener("click", onCaptureClick, true);
    return () => vp.removeEventListener("click", onCaptureClick, true);
  }, []);

  useEffect(() => {
    return () => {
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
      if (inertiaRaf.current != null) cancelAnimationFrame(inertiaRaf.current);
    };
  }, []);

  return (
    <div
      ref={viewportRef}
      className={`overflow-hidden touch-none select-none ${className}`.trim()}
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onPointerCancel={onPointerUp}
      role="application"
      aria-label="Infinite canvas - drag or scroll to pan"
    >
      <div
        ref={contentRef}
        className={`inline-grid w-max min-w-full will-change-transform ${gridClassName}`}
        style={{ padding: BOUNDS_PADDING }}
      >
        {children}
      </div>
    </div>
  );
}
