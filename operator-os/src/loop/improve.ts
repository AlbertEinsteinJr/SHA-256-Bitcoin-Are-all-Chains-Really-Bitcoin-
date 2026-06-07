// The self-improvement engine (Artifact 3). Eval-gated, archive-on-promote,
// reward-hack + saturation aware. Refuses production / safety-gated targets.
import type { LLMClient, EmbeddingsClient, CallContext, EvalResult, EvalSuiteFile } from "../contracts/index";
import { beats } from "../contracts/schemas/eval";
import { scoreComponent } from "../eval/engine";
import { generateVariants } from "./variants";
import { DEFAULT_PROMPT } from "../eval/components/vapi-dispatch-intent";
import { ctx as mkctx } from "../contracts/schemas/common";
import { ConstitutionViolation } from "../contracts/index";

const PRODUCTION_TARGETS = new Set(["stripe-payout", "live-site", "dot-compliance"]);

export interface ImproveReport {
  component: string;
  startScore: { passed: number; total: number };
  finalScore: { passed: number; total: number };
  promoted: boolean;
  chosenApproach: string | null;
  archived: string | null;
  rewardHackFlag: boolean;
  saturated: boolean;
  notes: string[];
}

export interface ImproveOptions {
  component: string;
  suite: EvalSuiteFile;
  runJudge?: boolean;
  basePrompt?: string;
}

/** One improvement iteration. Returns a structured report (no DB dependency). */
export async function improveOnce(
  llm: LLMClient,
  embeddings: EmbeddingsClient,
  opts: ImproveOptions,
  context: CallContext = mkctx({ actor: "loop" }),
): Promise<ImproveReport> {
  if (PRODUCTION_TARGETS.has(opts.component)) {
    throw new ConstitutionViolation(
      `loop refuses production / safety-gated target: ${opts.component} (CLAUDE.md §4)`,
    );
  }
  const notes: string[] = [];
  const basePrompt = opts.basePrompt ?? DEFAULT_PROMPT;

  const baseline = await scoreComponent(opts.suite, llm, { promptBody: basePrompt, runJudge: opts.runJudge }, context);
  const gate = (r: EvalResult) => ({ passed: r.detPassed + r.holdoutPassed, total: r.detTotal + r.holdoutTotal });
  let best = baseline;
  let bestPrompt = basePrompt;
  let chosenApproach: string | null = null;

  const failing = baseline.cases.filter((c) => !c.pass && !c.inconclusive).map((c) => c.caseId);
  if (failing.length === 0) {
    notes.push("baseline already passes all scored cases");
    return {
      component: opts.component,
      startScore: gate(baseline),
      finalScore: gate(baseline),
      promoted: false,
      chosenApproach: null,
      archived: null,
      rewardHackFlag: false,
      saturated: false,
      notes,
    };
  }

  const variants = await generateVariants(basePrompt, `failing cases: ${failing.join(", ")}`, llm, embeddings, context);
  notes.push(`generated ${variants.length} variants (${variants.filter((v) => v.diversityOk).length} distinct)`);

  for (const v of variants) {
    if (!v.diversityOk) continue;
    const r = await scoreComponent(opts.suite, llm, { promptBody: v.body, runJudge: opts.runJudge }, context);
    // Gate on deterministic + secret holdout, not the judge alone.
    if (beats(gate(r), gate(best))) {
      best = r;
      bestPrompt = v.body;
      chosenApproach = v.approach;
    }
  }

  const promoted = bestPrompt !== basePrompt && beats(gate(best), gate(baseline));
  // Reward-hack tripwire: a variant that "wins" on deterministic but tanks the
  // judge subscore relative to baseline is suspicious.
  const rewardHackFlag =
    promoted && best.judgeTotal > 0 && baseline.judgeTotal > 0 && best.judgePassed < baseline.judgePassed;
  if (rewardHackFlag) notes.push("REWARD-HACK SUSPECTED: judge subscore regressed; promotion frozen, add regression case");

  const saturated = !promoted; // no improvement this iteration

  return {
    component: opts.component,
    startScore: gate(baseline),
    finalScore: gate(best),
    promoted: promoted && !rewardHackFlag,
    chosenApproach: promoted && !rewardHackFlag ? chosenApproach : null,
    archived: promoted && !rewardHackFlag ? `${opts.component}.v1.score${gate(baseline).passed}` : null,
    rewardHackFlag,
    saturated,
    notes,
  };
}
