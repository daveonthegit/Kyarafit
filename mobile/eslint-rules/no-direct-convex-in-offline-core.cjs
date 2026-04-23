/**
 * KFM-114: Offline Core screens must use offline bridge hooks, not direct convex/react hooks.
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow direct convex/react useQuery/useMutation hooks in Offline Core surfaces; use @/offline hooks instead.",
    },
    schema: [],
    messages: {
      noDirectHook:
        "Offline Core screen uses direct convex/react '{{hook}}'. Import '{{hook}}' from '@/offline' (useOfflineQuery/useOfflineMutation bridge) instead.",
      noDirectImport:
        "Offline Core screen should not import from 'convex/react'. Use hooks re-exported by '@/offline'.",
    },
  },

  create(context) {
    const filename = (context.filename || "").replace(/\\/g, "/");
    const inOfflineCore =
      filename.includes("/src/screens/build-detail/") ||
      filename.includes("/src/screens/conventions/") ||
      filename.includes("/app/(app)/(tabs)/builds.tsx") ||
      filename.includes("/app/(app)/(tabs)/elements.tsx") ||
      filename.includes("/app/(app)/(tabs)/planner.tsx") ||
      filename.includes("/app/(app)/packing.tsx") ||
      filename.includes("/app/(app)/itinerary.tsx") ||
      filename.includes("/app/(app)/conventions/");

    if (!inOfflineCore) return {};

    return {
      ImportDeclaration(node) {
        if (node.source?.value !== "convex/react") return;
        let hasFlaggedHook = false;
        for (const spec of node.specifiers) {
          if (spec.type !== "ImportSpecifier") continue;
          if (spec.imported.type !== "Identifier") continue;
          const imported = spec.imported.name;
          if (
            imported === "useQuery" ||
            imported === "useMutation" ||
            imported === "usePaginatedQuery"
          ) {
            hasFlaggedHook = true;
            context.report({
              node: spec,
              messageId: "noDirectHook",
              data: { hook: imported },
            });
          }
        }
        if (!hasFlaggedHook) {
          context.report({ node, messageId: "noDirectImport" });
        }
      },
    };
  },
};
