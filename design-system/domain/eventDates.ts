/**
 * Editorial date formatting for events/conventions.
 * Renders ISO dates ("2026-08-19") as "AUG 19 – 22, 2026" instead of raw ISO,
 * shared by web and mobile so both platforms read the same way.
 */

function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function formatSingle(iso: string, withYear: boolean, locale: string): string {
  const d = parseIsoDate(iso);
  const month = d.toLocaleDateString(locale, { month: "short" }).toUpperCase();
  return `${month} ${d.getDate()}${withYear ? `, ${d.getFullYear()}` : ""}`;
}

/** "2026-08-19", "2026-08-22" → "AUG 19 – 22, 2026"; collapses same-month ranges. */
export function formatEventDateRange(
  startDate: string,
  endDate: string,
  locale: string = "en-US"
): string {
  if (startDate === endDate) return formatSingle(startDate, true, locale);
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${formatSingle(startDate, false, locale)} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${formatSingle(startDate, false, locale)} – ${formatSingle(endDate, true, locale)}`;
}

/** "2026-08-19" → "AUG 19, 2026". */
export function formatEventDate(iso: string, locale: string = "en-US"): string {
  return formatSingle(iso, true, locale);
}
