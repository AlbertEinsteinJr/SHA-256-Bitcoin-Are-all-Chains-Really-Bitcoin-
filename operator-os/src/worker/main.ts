// Long-lived queue worker (runs OFF Vercel — Fly/Railway/container/local).
// Drains job_queue with claim_job (FOR UPDATE SKIP LOCKED). Each step is short
// and idempotent; KILL + caps are checked at the top of every step.
import { boot } from "../core/kernel";
import { ctx } from "../contracts/schemas/common";
import { createSupabaseDb } from "../core/infra/db";
import { hasSupabase } from "../core/env";
import { loadSuite } from "../eval/loadSuite";
import { improveOnce } from "../loop/improve";
import { hasAnthropic } from "../core/env";

const WORKER_ID = `w_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;

async function processOne(): Promise<boolean> {
  const sb = createSupabaseDb(true);
  const claimed = await sb.rpc<unknown[]>("claim_job", { p_worker: WORKER_ID });
  const job = Array.isArray(claimed) ? (claimed[0] as { id: string; step: string } | undefined) : undefined;
  if (!job) return false;

  const context = ctx({ actor: "worker" });
  const { container, halted } = await boot(context, { skipIntegrity: true });
  if (halted) {
    await sb.raw().from("job_queue").update({ status: "pending", run_at: new Date(Date.now() + 60000).toISOString() }).eq("id", job.id);
    return true;
  }

  try {
    if (job.step === "loop.next" || job.step === "loop.start") {
      const suite = await loadSuite("vapi-dispatch-intent");
      const report = await improveOnce(container.llm, container.embeddings, {
        component: "vapi-dispatch-intent",
        suite,
        runJudge: hasAnthropic(),
      }, context);
      await container.audit.record(
        { actor: "worker", action: "loop.iteration", afterState: report, source: "real" },
        context,
      );
    }
    await sb.raw().from("job_queue").update({ status: "done" }).eq("id", job.id);
  } catch (e) {
    await sb.raw().from("job_queue").update({ status: "failed", last_error: (e as Error).message }).eq("id", job.id);
  }
  return true;
}

async function main() {
  if (!hasSupabase()) {
    console.error("worker requires Supabase env (NEXT_PUBLIC_SUPABASE_URL + key)");
    process.exit(1);
  }
  console.log(`operator-os worker ${WORKER_ID} draining job_queue…`);
  // graceful loop with backoff when idle
  for (;;) {
    const did = await processOne().catch((e) => {
      console.error("worker error", e);
      return false;
    });
    await new Promise((r) => setTimeout(r, did ? 200 : 3000));
  }
}

main();
