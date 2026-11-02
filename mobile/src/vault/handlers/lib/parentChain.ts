import type { VaultReader } from "../../store";

/**
 * The real ancestor chain of a row, root first, read from the rows themselves at write time (never
 * from cached `ancestorIds`, which a half-finished sync can leave stale). A missing parent ends the
 * chain: a cycle can only run through rows that exist, so cycle checks stay sound, and a row whose
 * parent was just deleted elsewhere never blocks an unrelated move.
 */
export function readAncestorIds(
  db: VaultReader,
  parentId: string | undefined,
  field: "parentId" | "parentNodeId"
): string[] {
  const ancestors: string[] = [];
  const seen = new Set<string>();
  let id = parentId;
  while (id) {
    if (seen.has(id))
      throw new Error("The parent chain contains a cycle. Choose a different parent.");
    seen.add(id);
    const parent = db.get(id);
    if (!parent) break;
    ancestors.push(id);
    id = typeof parent[field] === "string" ? (parent[field] as string) : undefined;
  }
  return ancestors.reverse();
}
