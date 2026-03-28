/**
 * Build, build-node root links, and build task types.
 */

import { z } from "zod";

export const BUILD_STATUSES = ["idea", "wip", "ready", "archived"] as const;
export type BuildStatus = (typeof BUILD_STATUSES)[number];

export const buildSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  character: z.string().optional(),
  status: z.enum(BUILD_STATUSES),
  notes: z.string().optional(),
  imageUrl: z.string().optional(),
  budgetCents: z.number().int().min(0).optional().nullable(),
  targetDate: z.string().optional().nullable(), // ISO date string YYYY-MM-DD
  tasksTotal: z.number().int().default(0),
  tasksChecked: z.number().int().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Build = z.infer<typeof buildSchema>;

export const createBuildSchema = z.object({
  name: z.string().min(1),
  character: z.string().optional(),
  status: z.enum(BUILD_STATUSES).default("idea"),
  notes: z.string().optional(),
  imageUrl: z.string().min(1),
  budgetCents: z.number().int().min(0).optional().nullable(),
  targetDate: z.string().optional().nullable(), // YYYY-MM-DD
});

export type CreateBuildInput = z.infer<typeof createBuildSchema>;

export const updateBuildSchema = z.object({
  name: z.string().min(1).optional(),
  character: z.string().optional().nullable(),
  status: z.enum(BUILD_STATUSES).optional(),
  notes: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  budgetCents: z.number().int().min(0).optional().nullable(),
  targetDate: z.string().optional().nullable(), // YYYY-MM-DD
});

export type UpdateBuildInput = z.infer<typeof updateBuildSchema>;

export const linkBuildItemsSchema = z.object({
  cosplayNodeIds: z.array(z.string().uuid()),
});

export type LinkBuildItemsInput = z.infer<typeof linkBuildItemsSchema>;

/** Build task: can belong to a build and/or be assigned to a cosplay element/material. */
export const buildTaskSchema = z.object({
  id: z.string().uuid(),
  buildId: z.string().uuid().optional(),
  label: z.string().min(1),
  cosplayNodeId: z.string().uuid().optional().nullable(),
  closetItemId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int(),
  checked: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type BuildTask = z.infer<typeof buildTaskSchema>;

export const createBuildTaskSchema = z.object({
  label: z.string().min(1),
  cosplayNodeId: z.string().uuid().optional().nullable(),
  closetItemId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export type CreateBuildTaskInput = z.infer<typeof createBuildTaskSchema>;

export const updateBuildTaskSchema = z.object({
  label: z.string().min(1).optional(),
  cosplayNodeId: z.string().uuid().optional().nullable(),
  closetItemId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().optional(),
  checked: z.boolean().optional(),
});

export type UpdateBuildTaskInput = z.infer<typeof updateBuildTaskSchema>;
