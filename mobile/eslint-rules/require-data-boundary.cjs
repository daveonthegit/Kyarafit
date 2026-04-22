/**
 * KFM-022: Screens that call Convex read hooks must use DataBoundary for loading/empty/error/ready.
 * @see docs/mobile-rewrite/BLUEPRINT.md §3.12
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require DataBoundary when useQuery, usePaginatedQuery, or useOfflineQuery is used in app routes.",
    },
    schema: [],
    messages: {
      missingImport:
        "Import DataBoundary from @/ui (or src/ui) when using Convex query hooks on this screen.",
      missingJsx:
        "Wrap the screen content in <DataBoundary> so loading, empty, error, and ready states are handled consistently.",
      both: "Convex query hooks require DataBoundary: import DataBoundary from @/ui and render <DataBoundary ...>.",
    },
  },

  create(context) {
    const filename = context.filename.replace(/\\/g, "/");

    const isAppRoute =
      filename.includes("/app/") &&
      filename.endsWith(".tsx") &&
      !filename.endsWith("/_layout.tsx") &&
      !/\/\+[^/]+\.tsx$/.test(filename);

    if (!isAppRoute) {
      return {};
    }

    /** @type {import('estree').CallExpression | null} */
    let firstHook = null;
    let importsDataBoundary = false;
    let hasDataBoundaryJsx = false;

    function walk(node, visitor) {
      if (!node || typeof node !== "object") return;
      visitor(node);
      for (const key of Object.keys(node)) {
        if (key === "parent") continue;
        const val = /** @type {Record<string, unknown>} */ (node)[key];
        if (val && typeof val === "object") {
          if (Array.isArray(val)) {
            for (const item of val) walk(item, visitor);
          } else if ("type" in /** @type {object} */ (val)) {
            walk(val, visitor);
          }
        }
      }
    }

    return {
      ImportDeclaration(node) {
        for (const spec of node.specifiers) {
          if (
            spec.type === "ImportSpecifier" &&
            spec.imported.type === "Identifier" &&
            spec.imported.name === "DataBoundary"
          ) {
            importsDataBoundary = true;
          }
        }
      },

      CallExpression(node) {
        if (node.callee.type !== "Identifier") return;
        const name = node.callee.name;
        if (
          name === "useQuery" ||
          name === "usePaginatedQuery" ||
          name === "useOfflineQuery"
        ) {
          if (!firstHook) firstHook = node;
        }
      },

      "Program:exit"() {
        if (!firstHook) return;

        const ast = context.getSourceCode().ast;
        walk(ast, (node) => {
          if (
            node.type === "JSXOpeningElement" &&
            node.name.type === "JSXIdentifier" &&
            node.name.name === "DataBoundary"
          ) {
            hasDataBoundaryJsx = true;
          }
        });

        if (!importsDataBoundary && !hasDataBoundaryJsx) {
          context.report({
            node: firstHook,
            messageId: "both",
          });
        } else if (!importsDataBoundary) {
          context.report({
            node: firstHook,
            messageId: "missingImport",
          });
        } else if (!hasDataBoundaryJsx) {
          context.report({
            node: firstHook,
            messageId: "missingJsx",
          });
        }
      },
    };
  },
};
