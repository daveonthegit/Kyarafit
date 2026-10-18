/** Internal wire-format helpers. No platform dependencies or implicit clock. */
export type SnapshotJson =
  null | boolean | number | string | SnapshotJson[] | { [key: string]: SnapshotJson };

export class SnapshotFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotFormatError";
  }
}

export function fail(message: string): never {
  throw new SnapshotFormatError(message);
}

export function object(value: unknown): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    fail("Expected a plain JSON object.");
  }
  return value as Record<string, unknown>;
}

export function keys(value: Record<string, unknown>, expected: readonly string[]): void {
  if (
    Object.keys(value).length !== expected.length ||
    expected.some((key) => !Object.prototype.hasOwnProperty.call(value, key))
  ) {
    fail("Unexpected or missing snapshot fields.");
  }
}

export function timestamp(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail("Expected a non-negative safe integer timestamp or byte count.");
  }
  return value;
}

export function identifier(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) {
    fail("Expected a non-empty stable record id.");
  }
  return value;
}

/** Copies and sorts JSON keys; refuses lossy JSON values, cycles and excessive nesting. */
export function json(value: unknown, depth = 0): SnapshotJson {
  if (depth > 32) fail("Snapshot JSON nesting exceeds 32 levels.");
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return Object.is(value, -0) ? 0 : value;
  if (Array.isArray(value)) {
    if (Object.keys(value).length !== value.length) fail("Expected a dense JSON array.");
    return Array.from(value, (entry) => json(entry, depth + 1));
  }
  const source = object(value);
  if (Object.getOwnPropertySymbols(source).length) fail("JSON cannot contain symbol keys.");
  return Object.fromEntries(
    Object.keys(source)
      .sort()
      .map((key) => [key, json(source[key], depth + 1)])
  );
}

/** Sort already-validated JSON without counting the wire envelope toward payload depth. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) => {
    if (entry !== null && typeof entry === "object" && !Array.isArray(entry)) {
      const source = object(entry);
      return Object.fromEntries(
        Object.keys(source)
          .sort()
          .map((key) => [key, source[key]])
      );
    }
    return entry;
  });
}

/** Code-unit ordering, independent of host locale. */
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
