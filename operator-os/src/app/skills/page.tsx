import { getSkills } from "../data";

export const dynamic = "force-dynamic";

export default async function Skills() {
  const rows = await getSkills();
  return (
    <main>
      <div className="card">
        <h2>Skill library (Voyager) — admitted only after verified + passing eval</h2>
        <table>
          <thead><tr><th>name</th><th>v</th><th>score</th><th>status</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="muted">no skills admitted yet</td></tr>}
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td>{String(r.name)}</td>
                <td>{String(r.version)}</td>
                <td>{String(r.eval_score ?? "—")}</td>
                <td className={r.archived ? "muted" : "ok"}>{r.archived ? "archived" : r.verified ? "admitted" : "candidate"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
