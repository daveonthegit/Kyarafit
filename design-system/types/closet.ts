/**
 * Shared ClosetItem type and Zod schema (single source of truth).
 * Used by web and mobile for validation and API payloads.
 */

import { z } from 'zod';

export const CLOSET_CATEGORIES = [
  'wig',
  'prop',
  'armor',
  'garment',
  'shoe',
  'material',
  'other',
] as const;

export type ClosetCategory = (typeof CLOSET_CATEGORIES)[number];

export const closetItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  category: z.enum(CLOSET_CATEGORIES),
  tags: z.array(z.string()),
  notes: z.string().optional(),
  imageLocalUri: z.string().optional(),
  imageUrl: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ClosetItem = z.infer<typeof closetItemSchema>;

/** Payload for creating a closet item (id and timestamps set by backend or client). */
export const createClosetItemSchema = z.object({
  name: z.string().min(1),
  category: z.enum(CLOSET_CATEGORIES),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  imageLocalUri: z.string().optional(),
  imageUrl: z.string().optional(),
});

export type CreateClosetItemInput = z.infer<typeof createClosetItemSchema>;

/** Payload for updating a closet item (partial). */
export const updateClosetItemSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.enum(CLOSET_CATEGORIES).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
});

export type UpdateClosetItemInput = z.infer<typeof updateClosetItemSchema>;

/** API response: list of items */
export const closetListResponseSchema = z.object({
  items: z.array(closetItemSchema),
});

export type ClosetListResponse = z.infer<typeof closetListResponseSchema>;
