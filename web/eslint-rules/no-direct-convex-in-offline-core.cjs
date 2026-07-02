/**
 * Web port of mobile's KFM-114 guard: Offline Core surfaces must consume the offline bridge
 * (`@/lib/offline` → useOfflineQuery/useOfflineMutation), never `convex/react` hooks directly,
 * for local-first data. Scope is controlled by the `files` globs in web/eslint.config.mjs so it
 * can be expanded route-by-route as each surface is migrated onto the bridge.
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow direct convex/react useQuery/useMutation hooks in Offline Core surfaces; use @/lib/offline hooks instead.",
    },
    schema: [],
    messages: {
      noDirectHook:
        "Offline Core surface uses direct convex/react '{{hook}}'. Import '{{hook}}' from '@/lib/offline' (useOfflineQuery/useOfflineMutation bridge) instead.",
    },
  },

  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source?.value !== "convex/react") return;
        for (const spec of node.specifiers) {
          if (spec.type !== "ImportSpecifier") continue;
          if (spec.imported.type !== "Identifier") continue;
          const imported = spec.imported.name;
          if (
            imported === "useQuery" ||
            imported === "useMutation" ||
            imported === "usePaginatedQuery"
          ) {
            context.report({
              node: spec,
              messageId: "noDirectHook",
              data: { hook: imported },
            });
          }
        }
      },
    };
  },
};
