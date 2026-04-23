/**
 * Require semantic Kyarafit color utilities in migrated mobile surfaces.
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow raw Tailwind color utilities in design-system-managed mobile files.",
    },
    schema: [],
    messages: {
      rawColor: "Use shared `kyar-*` design tokens instead of raw color utilities in {{attr}}.",
    },
  },

  create(context) {
    const forbidden =
      /\b(?:bg|text|border|placeholder|from|via|to)-(?:white|black|neutral-\d{2,3}|gray-\d{2,3}|slate-\d{2,3}|stone-\d{2,3}|zinc-\d{2,3}|red-\d{2,3}|amber-\d{2,3}|violet-\d{2,3})\b/;

    function checkAttribute(node) {
      if (
        node.name?.type !== "JSXIdentifier" ||
        (node.name.name !== "className" && node.name.name !== "contentContainerClassName") ||
        !node.value
      ) {
        return;
      }

      const raw = context.getSourceCode().getText(node.value);
      if (forbidden.test(raw)) {
        context.report({
          node: node.value,
          messageId: "rawColor",
          data: { attr: node.name.name },
        });
      }
    }

    return {
      JSXAttribute: checkAttribute,
    };
  },
};
