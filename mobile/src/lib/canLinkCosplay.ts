import type { CosplayNodeType } from "@kyarafit/design-system/types";

/** Mirrors `isAllowedLink` in `convex/lib/cosplayGraph` for client-side pickers. */
export function isAllowedCosplayLink(
  parentType: CosplayNodeType,
  childType: CosplayNodeType
): boolean {
  return (
    (parentType === "element" && childType === "element") ||
    (parentType === "element" && childType === "material") ||
    (parentType === "material" && childType === "material")
  );
}
