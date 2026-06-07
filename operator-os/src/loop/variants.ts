// Generate 3 DISTINCT candidate variants (prompt bodies) that aim to fix
// failures without breaking passing cases. Diversity enforced via embedding
// cosine distance (reject near-duplicates).
import type { LLMClient, EmbeddingsClient, CallContext } from "../contracts/index";
import { MODELS } from "../core/infra/llm";

export interface VariantCandidate {
  approach: string;
  body: string;
  diversityOk: boolean;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return dot; // inputs are L2-normalized
}

const OFFLINE_APPROACHES: Array<{ approach: string; suffix: string }> = [
  { approach: "explicit-urgency-rules", suffix: "\nRULE: Treat any highway/interstate/shoulder/ramp/lane mention as urgent=true." },
  { approach: "severity-rubric", suffix: "\nRULE: undrivable+blocking=critical; urgent=high; engine/tow=high; safe-tire=medium; vague=low." },
  { approach: "asset-disambiguation", suffix: "\nRULE: reefer/trailer=trailer; tractor/semi/rig=truck; otherwise unknown." },
];

export async function generateVariants(
  currentPrompt: string,
  failureSummary: string,
  llm: LLMClient,
  embeddings: EmbeddingsClient,
  ctx: CallContext,
): Promise<VariantCandidate[]> {
  // Try the model; fall back to deterministic templated variants offline.
  const candidates: VariantCandidate[] = [];
  try {
    for (const seed of OFFLINE_APPROACHES) {
      const res = await llm.complete(
        {
          model: MODELS.OPUS,
          system:
            "You improve an extraction system prompt. Return ONLY the improved prompt text, no preamble.",
          messages: [
            {
              role: "user",
              content: `Current prompt:\n${currentPrompt}\n\nObserved failures:\n${failureSummary}\n\nProduce a DISTINCT improved prompt using the strategy "${seed.approach}".`,
            },
          ],
          maxTokens: 500,
        },
        ctx,
      );
      const body = res.text && !res.text.startsWith("fake") ? res.text : currentPrompt + seed.suffix;
      candidates.push({ approach: seed.approach, body, diversityOk: true });
    }
  } catch {
    for (const seed of OFFLINE_APPROACHES) {
      candidates.push({ approach: seed.approach, body: currentPrompt + seed.suffix, diversityOk: true });
    }
  }

  // Diversity check: reject near-duplicates (cosine > 0.98).
  try {
    const embs = await embeddings.embed(candidates.map((c) => c.body), ctx);
    for (let i = 0; i < candidates.length; i++) {
      for (let j = 0; j < i; j++) {
        if (cosine(embs[i]!, embs[j]!) > 0.98) candidates[i]!.diversityOk = false;
      }
    }
  } catch {
    /* keep all if embeddings unavailable */
  }
  return candidates;
}
