import { NextResponse } from "next/server";
import { buildContainer } from "../../container";
import { loadSuite } from "../../../eval/loadSuite";
import { improveOnce } from "../../../loop/improve";
import { hasAnthropic } from "../../../core/env";
import { ctx } from "../../../contracts/schemas/common";

export const dynamic = "force-dynamic";

export async function POST() {
  const c = buildContainer();
  if (await c.kill.isTripped().catch(() => false)) {
    return NextResponse.json({ error: "KILL switch tripped — loop refuses to run" }, { status: 423 });
  }
  const suite = await loadSuite("vapi-dispatch-intent");
  const report = await improveOnce(
    c.llm,
    c.embeddings,
    { component: "vapi-dispatch-intent", suite, runJudge: hasAnthropic() },
    ctx({ actor: "api" }),
  );
  return NextResponse.json(report);
}
export const GET = POST;
