import { z } from "zod";

export const Skill = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  version: z.number().int().positive().default(1),
  parentId: z.string().optional(),
  description: z.string().min(1),
  body: z.string().min(1),
  language: z.string().default("ts"),
  verified: z.boolean().default(false),
  evalScore: z.number().int().nullable().default(null),
  admitEvalId: z.string().optional(),
  archived: z.boolean().default(false),
});
export type Skill = z.infer<typeof Skill>;

export const SkillSearchHit = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  similarity: z.number(),
});
export type SkillSearchHit = z.infer<typeof SkillSearchHit>;

// Flywheel insert payloads (the only write path → the spine).
export const BreakdownInsert = z.object({
  locationGeo: z.string().optional(),
  truckMake: z.string().optional(),
  truckModel: z.string().optional(),
  symptom: z.string().min(1),
  component: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  region: z.string().optional(),
  source: z.enum(["directory", "dispatch", "inspection"]).default("dispatch"),
  correlationId: z.string().optional(),
});
export type BreakdownInsert = z.infer<typeof BreakdownInsert>;

export const DispatchInsert = z.object({
  breakdownId: z.string(),
  mechanicId: z.string().optional(),
  responseMin: z.number().int().optional(),
  repairMin: z.number().int().optional(),
  partsUsed: z.unknown().optional(),
  priceCents: z.number().int().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  outcome: z.string().optional(),
  region: z.string().optional(),
  slaTargetMin: z.number().int().optional(),
});
export type DispatchInsert = z.infer<typeof DispatchInsert>;

export const InspectionInsert = z.object({
  fleetId: z.string().optional(),
  assetId: z.string().optional(),
  truckMake: z.string().optional(),
  truckModel: z.string().optional(),
  mileage: z.number().int().optional(),
  inspector: z.string().optional(),
  defects: z.array(z.object({ component: z.string(), severity: z.string() })).default([]),
});
export type InspectionInsert = z.infer<typeof InspectionInsert>;

export const DirectoryConversionInsert = z.object({
  pageSlug: z.string(),
  query: z.string().optional(),
  locationGeo: z.string().optional(),
  channel: z.string().optional(),
  converted: z.boolean().default(false),
});
export type DirectoryConversionInsert = z.infer<typeof DirectoryConversionInsert>;
