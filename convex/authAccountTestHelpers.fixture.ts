import { convexTest } from "convex-test";
import { queryGeneric } from "convex/server";
import { v } from "convex/values";
import { components } from "./_generated/api";
import authSchema from "./betterAuth/schema";

const authModules = import.meta.glob("./betterAuth/**/*.ts");

export async function createAuthAccount(
  t: ReturnType<typeof convexTest>,
  email: string,
  verified = true
) {
  t.registerComponent("betterAuth", authSchema, authModules);
  const account = await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "user",
        data: { email, emailVerified: verified, name: "Account", createdAt: 1, updatedAt: 1 },
      },
    })
  );
  return account._id as string;
}

export function stubAuthAccounts(
  t: ReturnType<typeof convexTest>,
  accounts: Array<{ _id: string; email: string; emailVerified: boolean }>
) {
  t.registerComponent("betterAuth", authSchema, {
    "./_generated/server.ts": async () => import("./betterAuth/_generated/server"),
    "./adapter.ts": async () => ({
      findOne: queryGeneric({
        args: {
          model: v.string(),
          where: v.array(v.object({ field: v.string(), value: v.union(v.string(), v.boolean()) })),
        },
        handler: (_ctx, args) =>
          accounts.find((account) =>
            args.where.every(({ field, value }) => Reflect.get(account, field) === value)
          ) ?? null,
      }),
    }),
  });
}
