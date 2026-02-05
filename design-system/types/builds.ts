/**
 * Build (cosplay build), BuildTask checklist, and BuildItemLink types.
 */

import { z } from 'zod';

export const BUILD_STATUSES = ['idea', 'wip', 'ready'] as const;
export type BuildStatus = (typeof BUILD_STATUSES)[number];

export const buildSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  character: z.string().optional(),
  status: z.enum(BUILD_STATUSES),
  notes: z.string().optional(),
  imageUrl: z.string().optional(),
  budgetCents: z.number().int().min(0).optional().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Build = z.infer<typeof buildSchema>;

export const createBuildSchema = z.object({
  name: z.string().min(1),
  character: z.string().optional(),
  status: z.enum(BUILD_STATUSES).default('idea'),
  notes: z.string().optional(),
  imageUrl: z.string().optional(),
  budgetCents: z.number().int().min(0).optional().nullable(),
});

export type CreateBuildInput = z.infer<typeof createBuildSchema>;

export const updateBuildSchema = z.object({
  name: z.string().min(1).optional(),
  character: z.string().optional().nullable(),
  status: z.enum(BUILD_STATUSES).optional(),
  notes: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  budgetCents: z.number().int().min(0).optional().nullable(),
});

export type UpdateBuildInput = z.infer<typeof updateBuildSchema>;

export const linkBuildItemsSchema = z.object({
  closetItemIds: z.array(z.string().uuid()),
});

export type LinkBuildItemsInput = z.infer<typeof linkBuildItemsSchema>;

/** Build task: required item or step that can be linked to a closet item. */
export const buildTaskSchema = z.object({
  id: z.string().uuid(),
  buildId: z.string().uuid(),
  label: z.string().min(1),
  closetItemId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int(),
  checked: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type BuildTask = z.infer<typeof buildTaskSchema>;

export const createBuildTaskSchema = z.object({
  label: z.string().min(1),
  closetItemId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export type CreateBuildTaskInput = z.infer<typeof createBuildTaskSchema>;

export const updateBuildTaskSchema = z.object({
  label: z.string().min(1).optional(),
  closetItemId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().optional(),
  checked: z.boolean().optional(),
});

export type UpdateBuildTaskInput = z.infer<typeof updateBuildTaskSchema>;
