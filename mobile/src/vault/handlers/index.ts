import type { LocalMutationHandler, LocalQueryHandler } from "../types";
import * as builds from "./builds";
import * as conventions from "./conventions";
import * as cosplayNodes from "./cosplayNodes";
import * as media from "./media";
import * as users from "./users";
import * as workflow from "./workflow";

/**
 * Registry of personal-data functions that run against the local vault, keyed by the Convex
 * function name screens already use (`"builds:list"`). Anything listed here never reaches Convex
 * from the UI. Online-only surfaces (social, groups, collaborators, public pages, billing, profile)
 * are deliberately absent and keep calling Convex directly.
 */
export const LOCAL_QUERIES: Record<string, LocalQueryHandler> = {
  ...builds.queries,
  ...conventions.queries,
  ...cosplayNodes.queries,
  ...media.queries,
  ...users.queries,
  ...workflow.queries,
};

export const LOCAL_MUTATIONS: Record<string, LocalMutationHandler> = {
  ...builds.mutations,
  ...conventions.mutations,
  ...cosplayNodes.mutations,
  ...media.mutations,
  ...users.mutations,
  ...workflow.mutations,
};

/** Commands that only change device-local preferences and are never replicated to the cloud. */
export const DEVICE_LOCAL_MUTATIONS: ReadonlySet<string> = new Set(users.DEVICE_LOCAL);
