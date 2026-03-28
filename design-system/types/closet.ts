/**
 * Legacy compatibility shim.
 *
 * The active domain is now cosplay nodes/elements/materials. Keep these exports
 * temporarily while the rest of the app migrates away from closet naming.
 */

import { z } from "zod";
import {
  COSPLAY_CATEGORIES,
  COSPLAY_NODE_TYPES,
  COSPLAY_OVERALL_BUCKETS,
  type CosplayCategory,
} from "./cosplay";

export const CLOSET_CATEGORIES = COSPLAY_CATEGORIES;
export type ClosetCategory = CosplayCategory;

export const CLOSET_ITEM_STATUSES = ["planned", "in_progress", "complete"] as const;
export type ClosetItemStatus = (typeof CLOSET_ITEM_STATUSES)[number];

export const closetItemSchema = z.object({
  id: z.string().uuid(),
  nodeType: z.enum(COSPLAY_NODE_TYPES).optional(),
  name: z.string().min(1),
  category: z.enum(COSPLAY_CATEGORIES).optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  imageLocalUri: z.string().optional(),
  imageUrl: z.string().optional(),
  itemLink: z.string().url().optional().nullable(),
  sourceUrl: z.string().url().optional().nullable(),
  costCents: z.number().int().min(0).optional().nullable(),
  directCostCents: z.number().int().min(0).optional().nullable(),
  status: z.enum(CLOSET_ITEM_STATUSES).optional(),
  overallBucket: z.enum(COSPLAY_OVERALL_BUCKETS).optional(),
  completionTaskId: z.string().uuid().optional().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ClosetItem = z.infer<typeof closetItemSchema>;

export const createClosetItemSchema = z.object({
  name: z.string().min(1),
  category: z.enum(COSPLAY_CATEGORIES).optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  imageLocalUri: z.string().optional(),
  imageUrl: z.string().optional(),
  itemLink: z.string().url().optional().nullable(),
  costCents: z.number().int().min(0).optional().nullable(),
  status: z.enum(CLOSET_ITEM_STATUSES).optional(),
  completionTaskId: z.string().uuid().optional().nullable(),
});
export type CreateClosetItemInput = z.infer<typeof createClosetItemSchema>;

export const updateClosetItemSchema = createClosetItemSchema.partial().extend({
  category: z.enum(COSPLAY_CATEGORIES).optional().nullable(),
  notes: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  itemLink: z.string().url().optional().nullable(),
  costCents: z.number().int().min(0).optional().nullable(),
  completionTaskId: z.string().uuid().optional().nullable(),
});
export type UpdateClosetItemInput = z.infer<typeof updateClosetItemSchema>;

export const closetListResponseSchema = z.object({
  nodes: z.array(closetItemSchema),
});
export type ClosetListResponse = z.infer<typeof closetListResponseSchema>;
