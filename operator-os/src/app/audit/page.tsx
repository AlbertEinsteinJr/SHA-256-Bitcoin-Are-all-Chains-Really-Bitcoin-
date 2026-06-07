import { getRecentAudit } from "../data";

export const dynamic = "force-dynamic";

export default async function Audit() {
  const rows = await getRecentAudit();
  return (
    <main>
      <div className="card">
        <h2>Audit log — append-only, hash-chained, immutable on the DB</h2>
        <table>
          <thead><tr><th>id</th><th>ts</th><th>actor</th><th>action</th><th>entry_hash</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="muted">no entries / set Supabase env</td></tr>}
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td>{String(r.id)}</td>
                <td className="muted">{String(r.ts ?? "").slice(0, 19)}</td>
                <td>{String(r.actor)}</td>
                <td>{String(r.action)}</td>
                <td className="muted">{String(r.entry_hash ?? "").slice(0, 12)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
