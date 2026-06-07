// Eval engine — strictly binary. Deterministic predicates + secret holdout gate
// promotion; the judge informs. Rational integer scoring; suite_hash stamping.
import { createHash } from "node:crypto";
import type { LLMClient, CallContext } from "../contracts/index";
import {
  type EvalSuiteFile,
  type EvalResult,
  type CaseResult,
  EvalSuiteFile as SuiteSchema,
} from "../contracts/schemas/eval";
import { validate } from "../core/reliability";
import { ctx as mkctx } from "../contracts/schemas/common";
import { extractDispatchIntent, type DispatchIntent } from "./components/vapi-dispatch-intent";
import { judgeCase } from "./judge";

// Deterministic predicates: (output, expected, input) -> boolean. Pure & binary.
type Predicate = (output: DispatchIntent, expected: Record<string, unknown>) => boolean;
const PREDICATES: Record<string, Predicate> = {
  service_type_matches: (o, e) => o.service_type === e["service_type"],
  severity_matches: (o, e) => o.severity === e["severity"],
  urgent_matches: (o, e) => o.urgent === e["urgent"],
  asset_type_matches: (o, e) => o.asset_type === e["asset_type"],
  service_in_set: (o, e) => Array.isArray(e["one_of"]) && (e["one_of"] as string[]).includes(o.service_type),
  location_nonempty: (o) => o.location_hint.trim().length > 0,
};

export function suiteHash(suite: EvalSuiteFile): string {
  const canonical = JSON.stringify({
    component: suite.component,
    judgeVersion: suite.judgeVersion,
    cases: suite.cases.map((c) => ({ id: c.id, assert: c.assert })),
  });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

export interface ScoreOptions {
  promptBody: string;
  runJudge?: boolean; // skip when offline / no key (judge needs the model)
}

export async function scoreComponent(
  suite: EvalSuiteFile,
  llm: LLMClient,
  opts: ScoreOptions,
  context: CallContext = mkctx({ actor: "eval" }),
): Promise<EvalResult> {
  validate(SuiteSchema, suite);
  const start = Date.now();
  const cases: CaseResult[] = [];

  for (const c of suite.cases) {
    const transcript = String((c.input as { transcript?: string }).transcript ?? c.input);
    const output = await extractDispatchIntent(transcript, opts.promptBody, llm, context);

    let pass = false;
    let inconclusive = false;
    let evidence: string | undefined;

    if (c.assert.kind === "deterministic") {
      const pred = PREDICATES[c.assert.check];
      pass = pred ? pred(output, (c.expected ?? {}) as Record<string, unknown>) : false;
      evidence = `predicate ${c.assert.check} -> ${pass}`;
    } else if (opts.runJudge) {
      const v = await judgeCase(llm, c.assert.check, c.input, output, context);
      pass = v.pass;
      inconclusive = v.inconclusive;
      evidence = v.evidence;
    } else {
      // Offline: judge cases are skipped (not counted as pass).
      inconclusive = true;
      evidence = "judge skipped (no model)";
    }

    cases.push({ caseId: c.id, pass, inconclusive, kind: c.assert.kind, holdout: c.assert.holdout, evidence });
  }

  const count = (f: (c: CaseResult) => boolean) => cases.filter(f).length;
  const det = cases.filter((c) => c.kind === "deterministic");
  const judge = cases.filter((c) => c.kind === "judge" && !c.inconclusive);
  const holdout = cases.filter((c) => c.holdout);
  const scored = cases.filter((c) => !c.inconclusive);

  return {
    component: suite.component,
    suiteHash: suiteHash(suite),
    passed: count((c) => c.pass && !c.inconclusive),
    total: scored.length,
    detPassed: det.filter((c) => c.pass).length,
    detTotal: det.length,
    judgePassed: judge.filter((c) => c.pass).length,
    judgeTotal: judge.length,
    holdoutPassed: holdout.filter((c) => c.pass).length,
    holdoutTotal: holdout.length,
    costMicroUsd: 0,
    durationMs: Date.now() - start,
    cases,
  };
}
