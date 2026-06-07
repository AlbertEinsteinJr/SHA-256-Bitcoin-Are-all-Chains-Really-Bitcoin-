import { z } from "zod";

// Destructive / production capabilities. Each must be wrapped by guard().
export const CAPABILITIES = [
  "db.delete",
  "db.prod.write",
  "stripe.payout",
  "stripe.refund",
  "deploy.live",
  "skill.promote.prod",
  "eval.scoring.change",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const SafetyDecision = z.object({
  capability: z.string(),
  allowed: z.boolean(),
  reason: z.string(),
  nonce: z.string().optional(),
});
export type SafetyDecision = z.infer<typeof SafetyDecision>;

export const CapKind = z.enum(["tokens", "usd", "requests", "runtime_ms"]);
export type CapKind = z.infer<typeof CapKind>;

export const CapDecision = z.object({
  allowed: z.boolean(),
  remaining: z.number(),
  limit: z.number(),
});
export type CapDecision = z.infer<typeof CapDecision>;
