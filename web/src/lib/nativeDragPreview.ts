import type { DragEvent } from "react";

/**
 * Native HTML5 drag often shows no ghost image when the handle lives inside
 * overflow/scroll containers. Render the label to an off-screen <canvas>
 * (guaranteed rasterized) and use it as the drag image.
 */
export function setNativeDragLabelPreview(e: DragEvent<HTMLElement>, label: string): void {
  const dt = e.dataTransfer;
  if (!dt) return;
  try {
    const fontSize = 13;
    const padX = 14;
    const padY = 10;
    const radius = 8;
    const font = `${fontSize}px system-ui, sans-serif`;

    const measure = document.createElement("canvas").getContext("2d");
    if (!measure) return;
    measure.font = font;
    const textW = Math.min(measure.measureText(label).width, 260);

    const w = Math.ceil(textW + padX * 2);
    const h = Math.ceil(fontSize + padY * 2);
    const dpr = window.devicePixelRatio || 1;

    const canvas = document.createElement("canvas");
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${w}px;height:${h}px;pointer-events:none`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(0, 0, w, h, radius);
    } else {
      ctx.rect(0, 0, w, h);
    }
    ctx.fillStyle = "#18181b";
    ctx.fill();

    ctx.fillStyle = "#fafafa";
    ctx.font = font;
    ctx.textBaseline = "middle";
    ctx.fillText(label, padX, h / 2, textW);

    document.body.appendChild(canvas);
    dt.setDragImage(canvas, Math.round(w / 2), Math.round(h / 2));
    const cleanup = () => {
      window.removeEventListener("dragend", cleanup);
      canvas.remove();
    };
    window.addEventListener("dragend", cleanup);
  } catch {
    // Keep the native drag alive even when the custom preview can't be drawn.
  }
}
