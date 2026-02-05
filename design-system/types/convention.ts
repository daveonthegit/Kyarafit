/**
 * Convention, ConventionDayPlan, PackingListItem types.
 */

import { z } from "zod";

export const conventionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  location: z.string().optional(),
  imageUrl: z.string().optional(),
  startDate: z.string(), // YYYY-MM-DD
  endDate: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Convention = z.infer<typeof conventionSchema>;

export const createConventionSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional(),
  imageUrl: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type CreateConventionInput = z.infer<typeof createConventionSchema>;

export const updateConventionSchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type UpdateConventionInput = z.infer<typeof updateConventionSchema>;

export const dayPlanEntrySchema = z.object({
  date: z.string(), // YYYY-MM-DD
  buildId: z.string().uuid().nullable(),
  notes: z.string().optional(),
});

export type DayPlanEntry = z.infer<typeof dayPlanEntrySchema>;

export const replacePlanSchema = z.object({
  plan: z.array(dayPlanEntrySchema),
});

export type ReplacePlanInput = z.infer<typeof replacePlanSchema>;

export const conventionDayPlanSchema = z.object({
  id: z.string().uuid(),
  conventionId: z.string().uuid(),
  date: z.string(),
  buildId: z.string().uuid().nullable(),
  notes: z.string().optional(),
});

export type ConventionDayPlan = z.infer<typeof conventionDayPlanSchema>;

export const packingListItemSchema = z.object({
  id: z.string().uuid(),
  conventionId: z.string().uuid(),
  date: z.string().nullable(),
  buildId: z.string().uuid().nullable(),
  closetItemId: z.string().uuid().nullable(),
  label: z.string(),
  checked: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PackingListItem = z.infer<typeof packingListItemSchema>;

export const addManualPackingItemSchema = z.object({
  label: z.string().min(1),
  date: z.string().optional().nullable(),
  buildId: z.string().uuid().optional().nullable(),
});

export type AddManualPackingItemInput = z.infer<typeof addManualPackingItemSchema>;

export const updatePackingItemSchema = z.object({
  checked: z.boolean().optional(),
  label: z.string().min(1).optional(),
});

export type UpdatePackingItemInput = z.infer<typeof updatePackingItemSchema>;
