import { getLoopRuns } from "../data";

export const dynamic = "force-dynamic";

export default async function Loop() {
  const rows = await getLoopRuns();
  return (
    <main>
      <div className="card">
        <h2>Self-improvement loop runs — eval-gated, archive-on-promote</h2>
        <p className="muted">
          The loop runs as idempotent steps on a durable queue (no Vercel daemon). Trigger one from the cockpit;
          schedule via Vercel Cron → <code>/api/cron/tick</code>. Promotion requires beating the deterministic+holdout
          gate AND passing regression; reward-hack and saturation are detected.
        </p>
        <table>
          <thead><tr><th>started</th><th>component</th><th>iter</th><th>status</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="muted">no loop runs persisted yet (run one from the cockpit)</td></tr>}
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td className="muted">{String(r.started_at ?? "").slice(0, 19)}</td>
                <td>{String(r.component)}</td>
                <td>{String(r.iteration)}</td>
                <td>{String(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
