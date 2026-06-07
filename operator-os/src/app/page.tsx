import { getStatus, getRecentAudit, getLoopRuns } from "./data";
import { ControlPanel } from "./actions";

export const dynamic = "force-dynamic";

export default async function Cockpit() {
  const [status, audit, loops] = await Promise.all([getStatus(), getRecentAudit(), getLoopRuns()]);
  return (
    <main>
      <div className="row" style={{ marginBottom: 18 }}>
        <div className="card">
          <h2>System</h2>
          <div className="big">
            <span className={status.halted ? "badge halted" : "badge live"}>
              {status.halted ? "HALTED" : "LIVE"}
            </span>
          </div>
          <p className="muted">
            db {status.online ? "online" : "offline"} · anthropic {status.anthropic ? "on" : "off"}
          </p>
        </div>
        <div className="card">
          <h2>Audit entries</h2>
          <div className="big ok">{audit.length}</div>
          <p className="muted">append-only · hash-chained</p>
        </div>
        <div className="card">
          <h2>Loop runs</h2>
          <div className="big">{loops.length}</div>
          <p className="muted">eval-gated · archive-on-promote</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h2>Control plane</h2>
        <ControlPanel halted={status.halted} />
      </div>

      <div className="card">
        <h2>Recent audit (live, immutable)</h2>
        <table>
          <thead>
            <tr><th>id</th><th>actor</th><th>action</th><th>reason</th></tr>
          </thead>
          <tbody>
            {audit.length === 0 && (
              <tr><td colSpan={4} className="muted">no entries (set Supabase env in Vercel to read the live log)</td></tr>
            )}
            {audit.map((r) => (
              <tr key={String(r.id)}>
                <td>{String(r.id)}</td>
                <td>{String(r.actor)}</td>
                <td>{String(r.action)}</td>
                <td className="muted">{String(r.reason ?? "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
