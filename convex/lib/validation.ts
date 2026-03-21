/**
 * Input validation and sanitization for Convex mutations.
 * Use to enforce max lengths, strip control chars, and reject malformed input.
 */

/** Strip control characters and normalize line endings; trim. */
export function sanitizeString(s: string): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
    .trim();
}

/** Enforce max length: sanitize then throw if still too long. */
export function sanitizeAndLimit(
  value: string | undefined,
  maxLength: number,
  fieldName: string
): string {
  if (value == null || value === "") return "";
  const sanitized = sanitizeString(value);
  if (sanitized.length > maxLength) {
    throw new Error(`${fieldName} must be at most ${maxLength} characters`);
  }
  return sanitized;
}

/** Optional string: sanitize and limit; return undefined if empty. */
export function sanitizeOptional(
  value: string | undefined,
  maxLength: number,
  fieldName: string
): string | undefined {
  if (value == null || value === "") return undefined;
  const sanitized = sanitizeString(value);
  if (sanitized.length === 0) return undefined;
  if (sanitized.length > maxLength) {
    throw new Error(`${fieldName} must be at most ${maxLength} characters`);
  }
  return sanitized;
}

export const MAX_LENGTH = {
  name: 500,
  notes: 10_000,
  label: 500,
  character: 200,
  location: 300,
  tag: 100,
  category: 100,
  status: 50,
  email: 320,
  url: 2048,
  dateString: 20, // YYYY-MM-DD or similar
  username: 80,
  displayName: 200,
  bio: 500,
} as const;

/** Username: lowercase alphanumeric and underscores only; 1–username max length. */
export function validateUsername(value: string): string {
  const s = sanitizeString(value).toLowerCase();
  if (s.length === 0) throw new Error("Username is required");
  if (s.length > MAX_LENGTH.username)
    throw new Error(`Username must be at most ${MAX_LENGTH.username} characters`);
  if (!/^[a-z0-9_]+$/.test(s))
    throw new Error("Username can only contain letters, numbers, and underscores");
  return s;
}

/** Validate date string format (YYYY-MM-DD). */
export function validateDateString(value: string, fieldName: string): string {
  const s = sanitizeString(value);
  if (s.length > MAX_LENGTH.dateString) {
    throw new Error(`${fieldName} must be at most ${MAX_LENGTH.dateString} characters`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`${fieldName} must be in YYYY-MM-DD format`);
  }
  return s;
}

/** Validate URL if present (optional field). */
export function sanitizeOptionalUrl(value: string | undefined): string | undefined {
  if (value == null || value === "") return undefined;
  const s = sanitizeString(value);
  if (s.length === 0) return undefined;
  if (s.length > MAX_LENGTH.url)
    throw new Error(`URL must be at most ${MAX_LENGTH.url} characters`);
  try {
    new URL(s);
    return s;
  } catch {
    throw new Error("Invalid URL format");
  }
}

/** Limit number to a range (e.g. cost, sortOrder). */
export function clampNumber(
  value: number | undefined,
  min: number,
  max: number,
  fieldName: string
): number | undefined {
  if (value == null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a number`);
  }
  if (value < min || value > max) {
    throw new Error(`${fieldName} must be between ${min} and ${max}`);
  }
  return value;
}
