import { z } from "zod";

export const AuditEvent = z.object({
  actor: z.string(),
  action: z.string(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  beforeState: z.unknown().optional(),
  afterState: z.unknown().optional(),
  reason: z.string().optional(),
  costMicroUsd: z.number().int().nonnegative().default(0),
  approvalNonce: z.string().optional(), // token id only — NEVER the secret
  source: z.enum(["real", "simulated"]).default("real"),
  correlationId: z.string().optional(),
});
// Callers use the INPUT type (defaulted fields optional); the sink validate()s
// to the output type internally.
export type AuditEvent = z.input<typeof AuditEvent>;
