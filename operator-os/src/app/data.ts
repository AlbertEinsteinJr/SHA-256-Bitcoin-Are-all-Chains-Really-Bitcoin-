// Server-side data helpers for the dashboard. Read at request time (dynamic).
import { buildContainer } from "./container";
import { createSupabaseDb } from "../core/infra/db";
import { hasSupabase } from "../core/env";

export async function getStatus() {
  const c = buildContainer();
  let halted = false;
  try {
    halted = await c.kill.isTripped();
  } catch {
    /* offline */
  }
  return { online: c.online, halted, anthropic: Boolean(process.env.ANTHROPIC_API_KEY) };
}

type Row = Record<string, unknown>;

async function select(table: string, opts: { order?: string; limit?: number } = {}): Promise<Row[]> {
  if (!hasSupabase()) return [];
  try {
    const sb = createSupabaseDb(true).raw();
    let q = sb.from(table).select("*");
    if (opts.order) q = q.order(opts.order, { ascending: false });
    if (opts.limit) q = q.limit(opts.limit);
    const { data } = await q;
    return (data as Row[]) ?? [];
  } catch {
    return [];
  }
}

export const getRecentAudit = () => select("audit_log", { order: "id", limit: 25 });
export const getEvalRuns = () => select("eval_runs", { order: "created_at", limit: 25 });
export const getLoopRuns = () => select("loop_runs", { order: "started_at", limit: 25 });
export const getSkills = () => select("skills", { order: "created_at", limit: 50 });

export async function getOwnerMetrics() {
  const [responseByRegion, predicted, correction] = await Promise.all([
    select("v_response_time_by_region"),
    select("v_predicted_breakdowns_30d", { limit: 15 }),
    select("v_correction_rate"),
  ]);
  return { responseByRegion, predicted, correction };
}
