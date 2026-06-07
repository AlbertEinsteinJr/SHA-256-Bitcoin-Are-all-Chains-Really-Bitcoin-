import { z } from "zod";

export const LOOP_STEPS = [
  "loop.start",
  "eval.baseline",
  "analyze.failures",
  "variant.generate",
  "eval.variant",
  "decide.promote",
  "rewardhack.check",
  "loop.next",
] as const;
export type LoopStep = (typeof LOOP_STEPS)[number];

export const Variant = z.object({
  id: z.string().optional(),
  component: z.string(),
  approach: z.string(),
  body: z.string(),
  diversityOk: z.boolean().default(true),
});
export type Variant = z.infer<typeof Variant>;

export const LoopConfig = z.object({
  component: z.string(),
  maxIterations: z.number().int().positive().default(20),
  spendCapUsd: z.number().positive().default(5),
  ratePerMin: z.number().int().positive().default(30),
  trigger: z.enum(["manual", "cron"]).default("manual"),
});
export type LoopConfig = z.infer<typeof LoopConfig>;

export const JobMessage = z.object({
  step: z.enum(LOOP_STEPS),
  payload: z.record(z.unknown()).default({}),
});
export type JobMessage = z.infer<typeof JobMessage>;
