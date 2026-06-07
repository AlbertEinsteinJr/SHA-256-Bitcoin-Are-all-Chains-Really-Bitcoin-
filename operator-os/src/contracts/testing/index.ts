// Test doubles implementing the ports. Used by unit tests AND as the offline
// fallback so the OS runs without live external calls.
import { createHash } from "node:crypto";
import type {
  LLMClient,
  LLMRequest,
  LLMResponse,
  EmbeddingsClient,
  Logger,
  AuditSink,
  KillSwitch,
  CapsEnforcer,
} from "../ports/index";
import type { CallContext } from "../schemas/common";
import type { AuditEvent } from "../schemas/audit";
import type { CapDecision, CapKind } from "../schemas/safety";
import { KillSwitchTrippedError } from "../errors";

/** Deterministic LLM: returns canned responses keyed by request hash. */
export class FakeLLMClient implements LLMClient {
  constructor(private readonly scripted: Record<string, string> = {}) {}
  async complete(req: LLMRequest, _ctx: CallContext): Promise<LLMResponse> {
    const key = createHash("sha256").update(JSON.stringify(req.messages)).digest("hex").slice(0, 16);
    const text =
      this.scripted[key] ??
      this.scripted[req.messages.at(-1)?.content ?? ""] ??
      (req.jsonSchema ? '{"pass":true,"evidence":"fake-deterministic-verdict"}' : "fake-response");
    return {
      text,
      stopReason: "end",
      usage: { inputTokens: 10, outputTokens: 10 },
      costMicroUsd: 0,
    };
  }
}

/** Deterministic hash-embedding (same 1024 dims as Voyage) — no network. */
export class FakeEmbeddingsClient implements EmbeddingsClient {
  readonly dimensions = 1024;
  async embed(texts: string[], _ctx: CallContext): Promise<number[][]> {
    return texts.map((t) => hashEmbed(t, this.dimensions));
  }
}

export function hashEmbed(text: string, dims: number): number[] {
  const out = new Array<number>(dims).fill(0);
  const h = createHash("sha256").update(text).digest();
  for (let i = 0; i < dims; i++) out[i] = (h[i % h.length]! / 255) * 2 - 1;
  // L2 normalize for cosine.
  const norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0)) || 1;
  return out.map((v) => v / norm);
}

export class RecordingLogger implements Logger {
  readonly lines: string[] = [];
  private log(level: string, msg: string) {
    this.lines.push(`${level} ${msg}`);
  }
  debug(m: string) {
    this.log("debug", m);
  }
  info(m: string) {
    this.log("info", m);
  }
  warn(m: string) {
    this.log("warn", m);
  }
  error(m: string) {
    this.log("error", m);
  }
  child(): Logger {
    return this;
  }
}

export class RecordingAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];
  async record(event: AuditEvent, _ctx: CallContext): Promise<string> {
    this.events.push(event);
    return `audit_${this.events.length}`;
  }
}

export class FakeKillSwitch implements KillSwitch {
  private tripped = false;
  async isTripped() {
    return this.tripped;
  }
  async assertLive(_ctx: CallContext) {
    if (this.tripped) throw new KillSwitchTrippedError();
  }
  async trip(_reason: string) {
    this.tripped = true;
  }
  async reset() {
    this.tripped = false;
  }
  async heartbeat() {}
}

export class FakeCapsEnforcer implements CapsEnforcer {
  spent = 0;
  constructor(private readonly capMicroUsd = 5_000_000) {}
  async check(_k: CapKind, _a: number, _c: CallContext): Promise<CapDecision> {
    return { allowed: this.spent < this.capMicroUsd, remaining: this.capMicroUsd - this.spent, limit: this.capMicroUsd };
  }
  async reserve(amount: number): Promise<boolean> {
    if (this.spent + amount > this.capMicroUsd) return false;
    this.spent += amount;
    return true;
  }
  async settle(_reserved: number, _actual: number) {}
}
