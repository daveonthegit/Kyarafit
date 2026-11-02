/**
 * SPEC STUB — NOT IMPLEMENTED. Throws until implemented per PRODUCT_SPEC.md §4.3 (REQ-047/048/049)
 * and DESIGN_SYSTEM.md §5.
 *
 * Pure, platform-agnostic behavior for ordered build media: reference images, process photos, and
 * the dated progress-update timeline. Web and mobile galleries both consume these so ordering /
 * captioning / timeline rules cannot drift.
 *
 * Do NOT change the spec tests to match a different behavior.
 */

export interface GalleryItem {
  id: string;
  sortOrder: number;
  caption?: string | null;
  [key: string]: unknown;
}

export interface ProgressUpdate {
  id: string;
  /** Epoch ms. */
  createdAt: number;
  note?: string | null;
  progressPercent?: number | null;
  imageRefs?: unknown[];
}

/** Append an item, assigning it the next contiguous sortOrder. Does not mutate the input. */
export function appendToGallery<T extends GalleryItem>(items: T[], item: T): T[] {
  const nextSortOrder = items.length === 0 ? 0 : Math.max(...items.map((i) => i.sortOrder)) + 1;
  return [...items, { ...item, sortOrder: nextSortOrder }];
}

/**
 * Reorder to match `orderedIds`, reindexing sortOrder to 0..n. Unknown ids are ignored; ids absent
 * from `orderedIds` keep their relative order at the end. Does not mutate the input.
 */
export function reorderGallery<T extends GalleryItem>(items: T[], orderedIds: string[]): T[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const ordered: T[] = [];
  const seen = new Set<string>();
  for (const id of orderedIds) {
    const found = byId.get(id);
    if (found && !seen.has(id)) {
      ordered.push(found);
      seen.add(id);
    }
  }
  for (const item of items) {
    if (!seen.has(item.id)) {
      ordered.push(item);
    }
  }
  return ordered.map((item, index) => ({ ...item, sortOrder: index }));
}

/** Remove the item with `id` and resequence remaining sortOrder contiguously. Pure. */
export function removeFromGallery<T extends GalleryItem>(items: T[], id: string): T[] {
  return items
    .filter((item) => item.id !== id)
    .map((item, index) => ({ ...item, sortOrder: index }));
}

/**
 * Set a trimmed caption on exactly the item with `id` (empty/whitespace clears it to null). Other
 * items untouched. Pure.
 */
export function setGalleryCaption<T extends GalleryItem>(
  items: T[],
  id: string,
  caption: string
): T[] {
  const trimmed = caption.trim();
  return items.map((item) =>
    item.id === id ? { ...item, caption: trimmed.length === 0 ? null : trimmed } : item
  );
}

/** Progress updates ordered newest-first by `createdAt` (stable for ties). Pure. */
export function sortProgressUpdates<T extends ProgressUpdate>(updates: T[]): T[] {
  return updates
    .map((update, index) => ({ update, index }))
    .sort((a, b) => b.update.createdAt - a.update.createdAt || a.index - b.index)
    .map(({ update }) => update);
}
