// Component under test: extract structured roadside-dispatch intent from a call
// transcript. This is what the self-improvement loop mutates (the prompt body).
import { z } from "zod";
import type { LLMClient, CallContext } from "../../contracts/index";
import { MODELS } from "../../core/infra/llm";
import { ctx as mkctx } from "../../contracts/schemas/common";

export const DispatchIntent = z.object({
  service_type: z.enum(["tire", "tow", "jumpstart", "fuel", "lockout", "engine", "other"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  urgent: z.boolean(),
  asset_type: z.enum(["truck", "trailer", "unknown"]),
  location_hint: z.string(),
});
export type DispatchIntent = z.infer<typeof DispatchIntent>;

export const DEFAULT_PROMPT = `You extract structured roadside-dispatch intent from a trucking breakdown call transcript.
Return ONLY the fields requested. service_type is the primary service needed.
urgent is true if the vehicle blocks traffic, is on a highway shoulder, or the driver reports danger.
severity reflects safety + downtime impact.`;

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    service_type: { type: "string", enum: ["tire", "tow", "jumpstart", "fuel", "lockout", "engine", "other"] },
    severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
    urgent: { type: "boolean" },
    asset_type: { type: "string", enum: ["truck", "trailer", "unknown"] },
    location_hint: { type: "string" },
  },
  required: ["service_type", "severity", "urgent", "asset_type", "location_hint"],
};

/** Deterministic heuristic — the offline fallback and a real baseline. */
export function heuristicExtract(transcript: string): DispatchIntent {
  const t = transcript.toLowerCase();
  const service_type: DispatchIntent["service_type"] =
    /flat|tire|blow ?out|tread/.test(t) ? "tire"
    : /tow|won'?t move|stuck|undrivable|accident/.test(t) ? "tow"
    : /jump|battery|dead|won'?t start/.test(t) ? "jumpstart"
    : /fuel|gas|diesel|empty tank|out of gas/.test(t) ? "fuel"
    : /lock|keys|locked out/.test(t) ? "lockout"
    : /engine|overheat|smoke|coolant|transmission|check engine/.test(t) ? "engine"
    : "other";
  const urgent = /highway|interstate|shoulder|blocking|traffic|danger|median|lane/.test(t);
  const asset_type: DispatchIntent["asset_type"] =
    /trailer|reefer/.test(t) ? "trailer" : /truck|tractor|rig|semi/.test(t) ? "truck" : "unknown";
  const severity: DispatchIntent["severity"] =
    urgent && service_type === "tow" ? "critical"
    : urgent ? "high"
    : service_type === "engine" || service_type === "tow" ? "high"
    : service_type === "other" ? "low"
    : "medium";
  const locMatch = transcript.match(/(?:on|near|at|mile marker|exit)\s+[A-Z0-9][^.,\n]{2,40}/i);
  return { service_type, severity, urgent, asset_type, location_hint: locMatch ? locMatch[0].trim() : "" };
}

/** Run the component: LLM structured extraction with deterministic fallback. */
export async function extractDispatchIntent(
  transcript: string,
  promptBody: string,
  llm: LLMClient,
  context: CallContext = mkctx({ actor: "eval" }),
): Promise<DispatchIntent> {
  try {
    const res = await llm.complete(
      {
        model: MODELS.OPUS,
        system: promptBody,
        messages: [{ role: "user", content: `Transcript:\n<call>\n${transcript}\n</call>` }],
        maxTokens: 400,
        jsonSchema: JSON_SCHEMA,
      },
      context,
    );
    const parsed = DispatchIntent.safeParse(JSON.parse(res.text));
    if (parsed.success) return parsed.data;
  } catch {
    /* fall through to heuristic */
  }
  return heuristicExtract(transcript);
}
