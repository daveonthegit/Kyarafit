/**
 * Geometry for an SVG progress ring, shared by web (DOM SVG) and mobile (react-native-svg) so both
 * render identical, correct rings. Uses the real circumference (radius-independent correctness) and
 * clamps the percent to 0–100. Pure. Single source of truth for the `strokeDasharray` /
 * `strokeDashoffset` a progress ring needs.
 */
export interface ProgressRingGeometry {
  /** Input percent clamped to 0–100. */
  clampedPercent: number;
  /** Full circle circumference for the given radius. */
  circumference: number;
  /** `strokeDasharray` value (the full circumference, repeated). */
  dashArray: string;
  /** `strokeDashoffset` value — how much of the ring is left empty. */
  dashOffset: number;
}

export function progressRingGeometry(percent: number, radius: number): ProgressRingGeometry {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clampedPercent / 100);
  return {
    clampedPercent,
    circumference,
    dashArray: `${circumference} ${circumference}`,
    dashOffset,
  };
}
