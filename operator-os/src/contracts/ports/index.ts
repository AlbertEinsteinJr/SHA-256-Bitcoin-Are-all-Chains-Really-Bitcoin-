// Ports = interfaces only, no implementations. Every subsystem codes against
// these; concrete clients are built only in src/app/container.ts.
import type { CallContext } from "../schemas/common";
import type { AuditEvent } from "../schemas/audit";
import type { CapDecision, CapKind, SafetyDecision } from "../schemas/safety";

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}
export interface LLMRequest {
  model: string;
  system?: string;
  messages: LLMMessage[];
  maxTokens: number;
  /** json_schema for structured output (output_config.format). */
  jsonSchema?: Record<string, unknown>;
}
export interface LLMResponse {
  text: string;
  stopReason: string;
  usage: { inputTokens: number; outputTokens: number };
  costMicroUsd: number;
}
export interface LLMClient {
  complete(req: LLMRequest, ctx: CallContext): Promise<LLMResponse>;
}

export interface EmbeddingsClient {
  readonly dimensions: number;
  embed(texts: string[], ctx: CallContext): Promise<number[][]>;
}

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, err?: unknown, meta?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

export interface AuditSink {
  record(event: AuditEvent, ctx: CallContext): Promise<string>;
}

export interface KillSwitch {
  isTripped(): Promise<boolean>;
  assertLive(ctx: CallContext): Promise<void>; // throws KillSwitchTrippedError
  trip(reason: string, ctx: CallContext): Promise<void>;
  reset(ctx: CallContext): Promise<void>;
  heartbeat(): Promise<void>;
}

export interface CapsEnforcer {
  check(kind: CapKind, amount: number, ctx: CallContext): Promise<CapDecision>;
  reserve(amountMicroUsd: number, ctx: CallContext): Promise<boolean>;
  settle(reservedMicroUsd: number, actualMicroUsd: number, ctx: CallContext): Promise<void>;
}

export interface SafetyKernel {
  /** Throws ApprovalRequiredError unless token === APPROVED-<action>-<YYYYMMDD>. */
  requireApproval(action: string, token: string | undefined, ctx: CallContext): Promise<SafetyDecision>;
  /** Wrap a destructive capability; refuses to run without a valid token. */
  guard<T>(
    capability: string,
    token: string | undefined,
    ctx: CallContext,
    fn: () => Promise<T>,
  ): Promise<T>;
}

// Thin repo-facing DB surface (lets subsystems avoid importing supabase-js).
export interface DbClient {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T>;
  insert<T = unknown>(table: string, row: Record<string, unknown>): Promise<T>;
  selectOne<T = unknown>(table: string, match: Record<string, unknown>): Promise<T | null>;
}

export interface Clock {
  now(): Date;
}
