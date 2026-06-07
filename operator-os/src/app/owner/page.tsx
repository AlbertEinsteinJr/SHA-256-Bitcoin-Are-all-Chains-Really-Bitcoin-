import { getOwnerMetrics } from "../data";

export const dynamic = "force-dynamic";

export default async function Owner() {
  const m = await getOwnerMetrics();
  return (
    <main>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Response time by region</h2>
        <table>
          <thead><tr><th>region</th><th>dispatches</th><th>avg response (min)</th><th>SLA rate</th></tr></thead>
          <tbody>
            {m.responseByRegion.length === 0 && <tr><td colSpan={4} className="muted">seed the flywheel to populate</td></tr>}
            {m.responseByRegion.map((r, i) => (
              <tr key={i}>
                <td>{String(r.region ?? "—")}</td><td>{String(r.dispatches)}</td>
                <td>{String(r.avg_response_min)}</td><td>{r.sla_rate != null ? `${Math.round(Number(r.sla_rate) * 100)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2>Predicted breakdowns (next 30d) — backtestable</h2>
        <table>
          <thead><tr><th>fleet</th><th>unit</th><th>component</th><th>probability</th></tr></thead>
          <tbody>
            {m.predicted.length === 0 && <tr><td colSpan={4} className="muted">run the predictor on seeded inspections</td></tr>}
            {m.predicted.map((r, i) => (
              <tr key={i}>
                <td>{String(r.fleet_name ?? "—")}</td><td>{String(r.unit_no ?? "—")}</td>
                <td>{String(r.component)}</td><td className="warn">{Math.round(Number(r.probability) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
