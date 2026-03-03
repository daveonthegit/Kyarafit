"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendNotificationEmail,
} from "./emailHelpers";

/** Send a welcome email to a newly signed-up user. Called internally on first login. */
export const sendWelcome = internalAction({
  args: {
    to: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (_ctx, { to, name }) => {
    await sendWelcomeEmail(to, name);
  },
});

/** Send an email verification link. */
export const sendVerification = internalAction({
  args: { to: v.string(), url: v.string() },
  handler: async (_ctx, { to, url }) => {
    await sendVerificationEmail(to, url);
  },
});

/** Send a password reset link. */
export const sendPasswordReset = internalAction({
  args: { to: v.string(), url: v.string() },
  handler: async (_ctx, { to, url }) => {
    await sendPasswordResetEmail(to, url);
  },
});

/** Send a generic transactional notification email. */
export const sendNotification = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    message: v.string(),
  },
  handler: async (_ctx, { to, subject, message }) => {
    await sendNotificationEmail(to, subject, message);
  },
});
