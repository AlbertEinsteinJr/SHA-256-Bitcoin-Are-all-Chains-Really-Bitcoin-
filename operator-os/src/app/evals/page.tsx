import { buildContainer } from "../container";
import { loadSuite } from "../../eval/loadSuite";
import { scoreComponent } from "../../eval/engine";
import { DEFAULT_PROMPT } from "../../eval/components/vapi-dispatch-intent";
import { hasAnthropic } from "../../core/env";

export const dynamic = "force-dynamic";

export default async function Evals() {
  const c = buildContainer();
  const suite = await loadSuite("vapi-dispatch-intent");
  const r = await scoreComponent(suite, c.llm, { promptBody: DEFAULT_PROMPT, runJudge: hasAnthropic() });
  return (
    <main>
      <div className="row" style={{ marginBottom: 16 }}>
        <div className="card"><h2>Score</h2><div className="big ok">{r.passed}/{r.total}</div><p className="muted">binary · strict</p></div>
        <div className="card"><h2>Deterministic</h2><div className="big">{r.detPassed}/{r.detTotal}</div></div>
        <div className="card"><h2>Holdout</h2><div className="big">{r.holdoutPassed}/{r.holdoutTotal}</div><p className="muted">secret gold</p></div>
        <div className="card"><h2>Judge</h2><div className="big">{r.judgeTotal === 0 ? "—" : `${r.judgePassed}/${r.judgeTotal}`}</div><p className="muted">opus, k-of-n</p></div>
      </div>
      <div className="card">
        <h2>vapi-dispatch-intent · suite {r.suiteHash}</h2>
        <table>
          <thead><tr><th></th><th>case</th><th>kind</th><th>evidence</th></tr></thead>
          <tbody>
            {r.cases.map((c) => (
              <tr key={c.caseId}>
                <td className={c.inconclusive ? "warn" : c.pass ? "ok" : "danger"}>{c.inconclusive ? "·" : c.pass ? "✓" : "✗"}</td>
                <td>{c.caseId}</td><td className="muted">{c.kind}</td><td className="muted">{c.evidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
