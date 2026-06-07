import { NextResponse } from "next/server";
import { buildContainer } from "../../container";
import { loadSuite } from "../../../eval/loadSuite";
import { scoreComponent } from "../../../eval/engine";
import { DEFAULT_PROMPT } from "../../../eval/components/vapi-dispatch-intent";
import { hasAnthropic } from "../../../core/env";

export const dynamic = "force-dynamic";

export async function POST() {
  const c = buildContainer();
  const suite = await loadSuite("vapi-dispatch-intent");
  const r = await scoreComponent(suite, c.llm, { promptBody: DEFAULT_PROMPT, runJudge: hasAnthropic() });
  return NextResponse.json({
    component: r.component,
    suiteHash: r.suiteHash,
    score: `${r.passed}/${r.total}`,
    deterministic: `${r.detPassed}/${r.detTotal}`,
    holdout: `${r.holdoutPassed}/${r.holdoutTotal}`,
    judge: r.judgeTotal === 0 ? "skipped (no model)" : `${r.judgePassed}/${r.judgeTotal}`,
    cases: r.cases,
  });
}
export const GET = POST;
