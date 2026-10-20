import type { VaultReader } from "../../store";

export function readAncestorIds(
  db: VaultReader, parentId: string | undefined, field: "parentId" | "parentNodeId"
): string[] {
  const ancestors: string[] = [];
  const seen = new Set<string>();
  let id = parentId;
  while (id) {
    if (seen.has(id)) throw new Error("The parent chain contains a cycle. Choose a different parent.");
    seen.add(id);
    const parent = db.get(id);
    if (!parent) throw new Error("Parent not found");
    ancestors.push(id);
    id = typeof parent[field] === "string" ? parent[field] as string : undefined;
  }
  return ancestors.reverse();
}
