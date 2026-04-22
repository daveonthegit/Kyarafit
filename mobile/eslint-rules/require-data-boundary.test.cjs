/**
 * Run: node eslint-rules/require-data-boundary.test.cjs
 */
const { RuleTester } = require("eslint");
const rule = require("./require-data-boundary.cjs");

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

ruleTester.run("require-data-boundary", rule, {
  valid: [
    {
      code: `export default function X() { return null; }`,
      filename: "mobile/app/(app)/ok.tsx",
    },
    {
      code: `
import { DataBoundary } from "@/ui";
import { useQuery } from "convex/react";
export default function Home() {
  const x = useQuery({});
  return <DataBoundary status="loading" children={() => null} />;
}`,
      filename: "mobile/app/(app)/home.tsx",
    },
  ],

  invalid: [
    {
      code: `
import { useQuery } from "convex/react";
export default function Home() {
  useQuery({});
  return null;
}`,
      filename: "mobile/app/(app)/bad.tsx",
      errors: [{ messageId: "both" }],
    },
  ],
});

console.log("require-data-boundary RuleTester OK");
