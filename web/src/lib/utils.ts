import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format storage size from MB to a short human-readable string (KB, MB, or GB). */
export function formatStorageMb(mb: number): string {
  if (mb < 0) return "unlimited";
  if (mb < 1 / 1024) return "< 1 KB";
  if (mb < 1) {
    const kb = Math.round(mb * 1024);
    return `${kb} KB`;
  }
  if (mb < 1000) {
    const whole = Math.floor(mb);
    const frac = mb - whole;
    if (frac < 0.01) return `${whole} MB`;
    return `${mb.toFixed(1)} MB`;
  }
  const gb = mb / 1024;
  return gb < 10 ? `${gb.toFixed(1)} GB` : `${Math.round(gb)} GB`;
}
