import { z } from "zod";

export const COSPLAY_NODE_TYPES = ["element", "material"] as const;
export type CosplayNodeType = (typeof COSPLAY_NODE_TYPES)[number];

export const COSPLAY_CATEGORIES = [
  "wig",
  "prop",
  "armor",
  "garment",
  "shoe",
  "material",
  "tool",
  "other",
] as const;
export type CosplayCategory = (typeof COSPLAY_CATEGORIES)[number];

export const ELEMENT_PURCHASE_STATUSES = ["to_buy", "bought"] as const;
export type ElementPurchaseStatus = (typeof ELEMENT_PURCHASE_STATUSES)[number];

export const ELEMENT_BUILD_STATUSES = ["not_started", "wip", "built"] as const;
export type ElementBuildStatus = (typeof ELEMENT_BUILD_STATUSES)[number];

export const MATERIAL_STATUSES = ["to_buy", "bought", "in_use", "complete"] as const;
export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

export const COSPLAY_OVERALL_BUCKETS = ["incomplete", "in_progress", "complete"] as const;
export type CosplayOverallBucket = (typeof COSPLAY_OVERALL_BUCKETS)[number];

export const COSPLAY_LINK_MODES = ["owned", "reference"] as const;
export type CosplayLinkMode = (typeof COSPLAY_LINK_MODES)[number];

export const COSPLAY_PRICING_MODES = ["total", "per_unit"] as const;
export type CosplayPricingMode = (typeof COSPLAY_PRICING_MODES)[number];

const cosplayNodeBaseSchema = z.object({
  id: z.string().uuid(),
  nodeType: z.enum(COSPLAY_NODE_TYPES),
  name: z.string().min(1),
  category: z.enum(COSPLAY_CATEGORIES).optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  imageLocalUri: z.string().optional(),
  imageUrl: z.string().optional(),
  sourceUrl: z.string().url().optional().nullable(),
  pricingMode: z.enum(COSPLAY_PRICING_MODES).optional(),
  directCostCents: z.number().int().min(0).optional().nullable(),
  unitCostCents: z.number().int().min(0).optional().nullable(),
  quantity: z.number().min(0).optional().nullable(),
  unit: z.string().optional().nullable(),
  purchaseStatus: z.enum(ELEMENT_PURCHASE_STATUSES).optional().nullable(),
  buildStatus: z.enum(ELEMENT_BUILD_STATUSES).optional().nullable(),
  materialStatus: z.enum(MATERIAL_STATUSES).optional().nullable(),
  manualOverallBucket: z.enum(COSPLAY_OVERALL_BUCKETS).optional().nullable(),
  overallBucket: z.enum(COSPLAY_OVERALL_BUCKETS).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const cosplayElementSchema = cosplayNodeBaseSchema.extend({
  nodeType: z.literal("element"),
  buildInstructions: z.string().optional(),
  finishedPhotoUrls: z.array(z.string()).optional(),
});

export const materialSchema = cosplayNodeBaseSchema.extend({
  nodeType: z.literal("material"),
  consumable: z.boolean().optional(),
});

export const cosplayNodeSchema = z.discriminatedUnion("nodeType", [
  cosplayElementSchema,
  materialSchema,
]);

export type CosplayElement = z.infer<typeof cosplayElementSchema>;
export type Material = z.infer<typeof materialSchema>;
export type CosplayNode = z.infer<typeof cosplayNodeSchema>;

export const createCosplayNodeSchema = z.object({
  nodeType: z.enum(COSPLAY_NODE_TYPES),
  name: z.string().min(1),
  category: z.enum(COSPLAY_CATEGORIES).optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  imageLocalUri: z.string().optional(),
  imageUrl: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  pricingMode: z.enum(COSPLAY_PRICING_MODES).optional(),
  directCostCents: z.number().int().min(0).optional().nullable(),
  unitCostCents: z.number().int().min(0).optional().nullable(),
  quantity: z.number().min(0).optional().nullable(),
  unit: z.string().optional().nullable(),
  purchaseStatus: z.enum(ELEMENT_PURCHASE_STATUSES).optional().nullable(),
  buildStatus: z.enum(ELEMENT_BUILD_STATUSES).optional().nullable(),
  materialStatus: z.enum(MATERIAL_STATUSES).optional().nullable(),
  manualOverallBucket: z.enum(COSPLAY_OVERALL_BUCKETS).optional().nullable(),
  buildInstructions: z.string().optional(),
  finishedPhotoUrls: z.array(z.string()).optional(),
  consumable: z.boolean().optional(),
});
export type CreateCosplayNodeInput = z.infer<typeof createCosplayNodeSchema>;

export const updateCosplayNodeSchema = createCosplayNodeSchema.partial();
export type UpdateCosplayNodeInput = z.infer<typeof updateCosplayNodeSchema>;

export const cosplayNodeLinkSchema = z.object({
  id: z.string().uuid(),
  parentNodeId: z.string().uuid(),
  childNodeId: z.string().uuid(),
  sortOrder: z.number().int(),
  linkMode: z.enum(COSPLAY_LINK_MODES),
});
export type CosplayNodeLink = z.infer<typeof cosplayNodeLinkSchema>;

export const buildCosplayLinkSchema = z.object({
  id: z.string().uuid(),
  buildId: z.string().uuid(),
  cosplayNodeId: z.string().uuid(),
  sortOrder: z.number().int(),
});
export type BuildCosplayLink = z.infer<typeof buildCosplayLinkSchema>;

export const buildNodeStateSchema = z.object({
  id: z.string().uuid(),
  buildId: z.string().uuid(),
  cosplayNodeId: z.string().uuid(),
  purchaseStatus: z.enum(ELEMENT_PURCHASE_STATUSES).optional().nullable(),
  buildStatus: z.enum(ELEMENT_BUILD_STATUSES).optional().nullable(),
  materialStatus: z.enum(MATERIAL_STATUSES).optional().nullable(),
  manualOverallBucket: z.enum(COSPLAY_OVERALL_BUCKETS).optional().nullable(),
  pricingMode: z.enum(COSPLAY_PRICING_MODES).optional().nullable(),
  directCostCents: z.number().int().min(0).optional().nullable(),
  unitCostCents: z.number().int().min(0).optional().nullable(),
  quantity: z.number().min(0).optional().nullable(),
  unit: z.string().optional().nullable(),
});
export type BuildNodeState = z.infer<typeof buildNodeStateSchema>;

export const cosplayListResponseSchema = z.object({
  nodes: z.array(cosplayNodeSchema),
});
export type CosplayListResponse = z.infer<typeof cosplayListResponseSchema>;
