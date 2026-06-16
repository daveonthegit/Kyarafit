/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as broadcasts from "../broadcasts.js";
import type * as buildCollaborators from "../buildCollaborators.js";
import type * as buildComments from "../buildComments.js";
import type * as buildLikes from "../buildLikes.js";
import type * as buildProcessPictures from "../buildProcessPictures.js";
import type * as buildReferenceImages from "../buildReferenceImages.js";
import type * as buildTasks from "../buildTasks.js";
import type * as builds from "../builds.js";
import type * as closetItems from "../closetItems.js";
import type * as conventions from "../conventions.js";
import type * as cosplayMigration from "../cosplayMigration.js";
import type * as cosplayNodes from "../cosplayNodes.js";
import type * as crons from "../crons.js";
import type * as email from "../email.js";
import type * as emailHelpers from "../emailHelpers.js";
import type * as files from "../files.js";
import type * as follows from "../follows.js";
import type * as groupConventionDays from "../groupConventionDays.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as idempotencyLedger from "../idempotencyLedger.js";
import type * as lib_accountDeletion from "../lib/accountDeletion.js";
import type * as lib_buildAccess from "../lib/buildAccess.js";
import type * as lib_buildPublicViewer from "../lib/buildPublicViewer.js";
import type * as lib_cosplayGraph from "../lib/cosplayGraph.js";
import type * as lib_idempotency from "../lib/idempotency.js";
import type * as lib_validation from "../lib/validation.js";
import type * as lib_workflowDomain from "../lib/workflowDomain.js";
import type * as lib_workflowProgress from "../lib/workflowProgress.js";
import type * as migrations from "../migrations.js";
import type * as push from "../push.js";
import type * as revenuecat from "../revenuecat.js";
import type * as seed from "../seed.js";
import type * as storageUsage from "../storageUsage.js";
import type * as users from "../users.js";
import type * as workflow from "../workflow.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  broadcasts: typeof broadcasts;
  buildCollaborators: typeof buildCollaborators;
  buildComments: typeof buildComments;
  buildLikes: typeof buildLikes;
  buildProcessPictures: typeof buildProcessPictures;
  buildReferenceImages: typeof buildReferenceImages;
  buildTasks: typeof buildTasks;
  builds: typeof builds;
  closetItems: typeof closetItems;
  conventions: typeof conventions;
  cosplayMigration: typeof cosplayMigration;
  cosplayNodes: typeof cosplayNodes;
  crons: typeof crons;
  email: typeof email;
  emailHelpers: typeof emailHelpers;
  files: typeof files;
  follows: typeof follows;
  groupConventionDays: typeof groupConventionDays;
  groups: typeof groups;
  http: typeof http;
  idempotencyLedger: typeof idempotencyLedger;
  "lib/accountDeletion": typeof lib_accountDeletion;
  "lib/buildAccess": typeof lib_buildAccess;
  "lib/buildPublicViewer": typeof lib_buildPublicViewer;
  "lib/cosplayGraph": typeof lib_cosplayGraph;
  "lib/idempotency": typeof lib_idempotency;
  "lib/validation": typeof lib_validation;
  "lib/workflowDomain": typeof lib_workflowDomain;
  "lib/workflowProgress": typeof lib_workflowProgress;
  migrations: typeof migrations;
  push: typeof push;
  revenuecat: typeof revenuecat;
  seed: typeof seed;
  storageUsage: typeof storageUsage;
  users: typeof users;
  workflow: typeof workflow;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
