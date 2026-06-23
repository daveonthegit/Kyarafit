/**
 * Pure filter + sort for a closet-item list, shared by the build link flow and the standalone
 * link-items page. Category filter ("all" = no filter), search across name/category/tags
 * (case-insensitive, trimmed), and sort by name / recency / selection. Pure and non-mutating.
 * Structural twin of `filterAndSortBuilds`.
 */

export type ClosetSortMode = "name" | "recent" | "selectedFirst";

/** Minimal shape these helpers read; callers pass richer rows and get the same type back. */
export interface ClosetItemFields {
  _id: string;
  name: string;
  category: string;
  tags?: string[];
  _creationTime?: number;
}

export interface ClosetItemsView {
  /** "all" applies no category filter; otherwise an exact (trimmed) category match. */
  categoryFilter: string;
  search: string;
  sortMode: ClosetSortMode;
  /** Used only by the "selectedFirst" sort. */
  selectedIds: ReadonlySet<string>;
}

export function filterAndSortClosetItems<T extends ClosetItemFields>(
  items: readonly T[],
  view: ClosetItemsView
): T[] {
  const { categoryFilter, search, sortMode, selectedIds } = view;

  let rows = [...items];

  if (categoryFilter !== "all") {
    rows = rows.filter((r) => (r.category ?? "").trim() === categoryFilter);
  }

  const q = search.trim().toLowerCase();
  if (q) {
    rows = rows.filter((r) => {
      if (r.name.toLowerCase().includes(q)) return true;
      if ((r.category ?? "").toLowerCase().includes(q)) return true;
      if (r.tags?.some((t) => t.toLowerCase().includes(q))) return true;
      return false;
    });
  }

  if (sortMode === "name") {
    rows.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortMode === "recent") {
    rows.sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0));
  } else {
    rows.sort((a, b) => {
      const sa = selectedIds.has(a._id) ? 1 : 0;
      const sb = selectedIds.has(b._id) ? 1 : 0;
      if (sa !== sb) return sb - sa;
      return a.name.localeCompare(b.name);
    });
  }

  return rows;
}

/** Sorted, de-duplicated list of the non-empty (trimmed) categories present in a closet. */
export function closetCategories(items: readonly ClosetItemFields[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    const c = item.category?.trim();
    if (c) set.add(c);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
