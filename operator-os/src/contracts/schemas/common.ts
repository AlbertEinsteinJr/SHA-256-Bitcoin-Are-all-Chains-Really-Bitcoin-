import { z } from "zod";

export const zUuid = z.string().uuid();
export const zTimestamp = z.string(); // ISO 8601
export const zMicroUsd = z.number().int().nonnegative();

// CallContext is threaded through every port so audit/caps/kill/cost correlate.
export const CallContext = z.object({
  traceId: z.string(),
  actor: z.enum(["loop", "eval", "api", "cli", "agent", "worker"]).default("api"),
  runId: z.string().optional(),
  correlationId: z.string().optional(),
  deadlineMs: z.number().optional(),
});
export type CallContext = z.infer<typeof CallContext>;

export const newTraceId = (): string =>
  `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export const ctx = (partial: Partial<CallContext> = {}): CallContext =>
  CallContext.parse({ traceId: partial.traceId ?? newTraceId(), ...partial });

export const usdToMicro = (usd: number): number => Math.round(usd * 1_000_000);
export const microToUsd = (micro: number): number => micro / 1_000_000;
