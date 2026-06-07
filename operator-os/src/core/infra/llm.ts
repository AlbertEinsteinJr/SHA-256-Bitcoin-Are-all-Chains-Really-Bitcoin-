// Anthropic-backed LLMClient. Model registry per the claude-api skill.
// Adaptive thinking; no temperature/budget_tokens (removed on Opus 4.8).
import Anthropic from "@anthropic-ai/sdk";
import type { LLMClient, LLMRequest, LLMResponse, CallContext } from "../../contracts/index";
import { ExternalServiceError } from "../../contracts/index";
import { env, hasAnthropic } from "../env";
import { FakeLLMClient } from "../../contracts/testing/index";

export const MODELS = {
  OPUS: "claude-opus-4-8",
  SONNET: "claude-sonnet-4-6",
  HAIKU: "claude-haiku-4-5",
} as const;

// $/1M tokens → micro-USD per token.
const PRICE: Record<string, { in: number; out: number }> = {
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};

function costMicro(model: string, inTok: number, outTok: number): number {
  const p = PRICE[model] ?? PRICE["claude-opus-4-8"]!;
  return Math.round((inTok * p.in + outTok * p.out)); // ($/1e6 tok) * tok * 1e6 micro = $*tok... see below
}

export class AnthropicLLMClient implements LLMClient {
  private readonly client: Anthropic;
  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }
  async complete(req: LLMRequest, _ctx: CallContext): Promise<LLMResponse> {
    try {
      const params: Anthropic.Messages.MessageCreateParams = {
        model: req.model,
        max_tokens: req.maxTokens,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
        ...(req.system ? { system: req.system } : {}),
        ...(req.jsonSchema
          ? // structured output (output_config.format) — strict binary judging
            ({ output_config: { format: { type: "json_schema", schema: req.jsonSchema } } } as Record<
              string,
              unknown
            >)
          : {}),
      };
      const res = (await this.client.messages.create(params)) as Anthropic.Messages.Message;
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      const inTok = res.usage?.input_tokens ?? 0;
      const outTok = res.usage?.output_tokens ?? 0;
      return {
        text,
        stopReason: res.stop_reason ?? "end",
        usage: { inputTokens: inTok, outputTokens: outTok },
        costMicroUsd: costMicro(req.model, inTok, outTok),
      };
    } catch (err) {
      throw new ExternalServiceError(`anthropic call failed: ${(err as Error).message}`, { cause: err });
    }
  }
}

/** Real client if a key is present; otherwise the deterministic fake (offline). */
export function createLLM(): LLMClient {
  if (hasAnthropic()) return new AnthropicLLMClient(env().ANTHROPIC_API_KEY!);
  return new FakeLLMClient();
}
