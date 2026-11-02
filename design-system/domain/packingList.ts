/**
 * SPEC STUB — NOT IMPLEMENTED. Throws until implemented per PRODUCT_SPEC.md §4.4 (REQ-053).
 *
 * Pure logic for regenerating a packing list from the current build/convention inputs while
 * preserving user intent: manually-added items are never lost, and checked state is retained for
 * generated items that still apply. Shared so web and mobile regenerate identically.
 *
 * Do NOT change the spec tests to match a different behavior.
 */

export type PackingItemSource = "generated" | "manual";

export interface PackingItem {
  id: string;
  /** Stable identity used to match an item across regenerations (e.g. derived from the source). */
  key: string;
  label: string;
  source: PackingItemSource;
  checked: boolean;
}

/**
 * Regenerate a packing list:
 * - Manual items are always preserved (with their checked state).
 * - Generated items present in `generated` are kept; checked state is carried over from `existing`
 *   when the same `key` was present before.
 * - Generated items no longer produced are dropped.
 * - Newly generated items appear unchecked.
 * Pure: does not mutate inputs.
 */
export function regeneratePackingList(
  existing: PackingItem[],
  generated: PackingItem[]
): PackingItem[] {
  const priorGeneratedByKey = new Map(
    existing.filter((i) => i.source === "generated").map((i) => [i.key, i])
  );

  const regenerated: PackingItem[] = generated.map((item) => {
    const prior = priorGeneratedByKey.get(item.key);
    return { ...item, checked: prior ? prior.checked : item.checked };
  });

  const manual = existing.filter((i) => i.source === "manual").map((i) => ({ ...i }));

  return [...regenerated, ...manual];
}
