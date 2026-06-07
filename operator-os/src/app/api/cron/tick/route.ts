import { NextResponse } from "next/server";
import { buildContainer } from "../../../container";
import { createSupabaseDb } from "../../../../core/infra/db";
import { hasSupabase } from "../../../../core/env";

export const dynamic = "force-dynamic";

// Vercel Cron hits this every minute. It does NOT run the loop (serverless has no
// long process) — it only enqueues the next pending step and honors KILL.
export async function GET() {
  const c = buildContainer();
  if (await c.kill.isTripped().catch(() => false)) {
    return NextResponse.json({ ticked: false, reason: "halted" });
  }
  if (!hasSupabase()) return NextResponse.json({ ticked: false, reason: "offline" });
  try {
    const sb = createSupabaseDb(true).raw();
    // enqueue a heartbeat/loop tick if none pending (idempotent via dedupe_key)
    const dedupe = `tick-${new Date().toISOString().slice(0, 16)}`;
    await sb.from("job_queue").insert({ step: "loop.next", payload: {}, dedupe_key: dedupe }).select();
    await c.kill.heartbeat();
    return NextResponse.json({ ticked: true });
  } catch (e) {
    return NextResponse.json({ ticked: false, error: (e as Error).message });
  }
}
