"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
const recipient = makeFunctionReference<
  "query",
  { externalId?: string; to?: string },
  { to: string; name?: string } | null
>("emailRecipients:resolve");
import {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendNotificationEmail,
} from "./emailHelpers";

/** Send a welcome email to a newly signed-up user. Called internally on first login. */
export const sendWelcome = internalAction({
  args: {
    externalId: v.optional(v.string()),
    to: v.optional(v.string()), // Compatibility with already-scheduled actions.
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const current = await ctx.runQuery(recipient, { externalId: args.externalId, to: args.to });
    if (current) await sendWelcomeEmail(current.to, current.name);
  },
});

/** Send an email verification link. */
export const sendVerification = internalAction({
  args: { to: v.string(), url: v.string() },
  handler: async (ctx, { to, url }) => {
    const current = await ctx.runQuery(recipient, { to });
    if (current) await sendVerificationEmail(current.to, url);
  },
});

/** Send a password reset link. */
export const sendPasswordReset = internalAction({
  args: { to: v.string(), url: v.string() },
  handler: async (ctx, { to, url }) => {
    const current = await ctx.runQuery(recipient, { to });
    if (current) await sendPasswordResetEmail(current.to, url);
  },
});

/** Send a generic transactional notification email. */
export const sendNotification = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx, { to, subject, message }) => {
    const current = await ctx.runQuery(recipient, { to });
    if (current) await sendNotificationEmail(current.to, subject, message);
  },
});
