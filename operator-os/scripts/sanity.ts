// §7 sanity pass — verifies the constitution's invariants hold in code.
import { z } from "zod";
import { validate, withReflection, chain } from "../src/core/reliability";
import { DefaultSafetyKernel } from "../src/core/safety";
import { SkillLibrary } from "../src/skills/library";
import { improveOnce } from "../src/loop/improve";
import { loadSuite } from "../src/eval/loadSuite";
import { scoreComponent } from "../src/eval/engine";
import { DEFAULT_PROMPT } from "../src/eval/components/vapi-dispatch-intent";
import { ctx } from "../src/contracts/schemas/common";
import {
  RecordingAuditSink,
  FakeLLMClient,
  FakeEmbeddingsClient,
} from "../src/contracts/testing/index";

type Check = { name: string; pass: boolean; detail?: string };
const results: Check[] = [];
const ok = (name: string, pass: boolean, detail?: string) => results.push({ name, pass, detail });
async function expectThrow(name: string, fn: () => Promise<unknown> | unknown) {
  try {
    await fn();
    ok(name, false, "expected throw, none");
  } catch {
    ok(name, true);
  }
}

async function run() {
  const context = ctx({ actor: "cli" });
  const audit = new RecordingAuditSink();
  const safety = new DefaultSafetyKernel(audit, "UTC");

  // 1. boundary validation rejects bad input
  await expectThrow("validate rejects invalid input", () => validate(z.object({ a: z.number() }), { a: "x" }));

  // 2. approval gate: no token throws + is audited
  await expectThrow("requireApproval throws without token", () =>
    safety.requireApproval("db.delete", undefined, context),
  );
  ok("blocked approval is audited", audit.events.some((e) => e.action.startsWith("approval.denied")));

  // 3. approval gate: correct dated token passes
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const dec = await safety.requireApproval("db.delete", `APPROVED-db.delete-${today}`, context).catch(() => null);
  ok("requireApproval passes with valid dated token", dec?.allowed === true);

  // 4. guard refuses destructive op without token
  await expectThrow("guard refuses without token", () =>
    safety.guard("stripe.payout", undefined, context, async () => "paid"),
  );

  // 5. chain enforces <=5 steps
  await expectThrow("chain rejects >5 steps", () =>
    chain(Array.from({ length: 6 }, (_, i) => ({ name: `s${i}`, run: async (c: number) => c + 1 })), 0),
  );

  // 6. withReflection retries once then succeeds
  let attempts = 0;
  const rr = await withReflection(async () => {
    attempts++;
    if (attempts < 2) throw new Error("fail once");
    return "ok";
  });
  ok("withReflection retries then succeeds", rr.value === "ok" && rr.attempts === 2);

  // 7. eval engine runs the seed suite (deterministic all pass)
  const suite = await loadSuite("vapi-dispatch-intent");
  const evalRes = await scoreComponent(suite, new FakeLLMClient(), { promptBody: DEFAULT_PROMPT, runJudge: false });
  ok("eval engine: deterministic all pass", evalRes.detPassed === evalRes.detTotal && evalRes.detTotal >= 16);

  // 8. skills admission rejects unverified
  const lib = new SkillLibrary({} as never, new FakeEmbeddingsClient());
  await expectThrow("skill admission rejects unverified", () =>
    lib.addSkill({ name: "x", version: 1, description: "d", body: "b", language: "ts", verified: false, evalScore: null, archived: false }),
  );

  // 9. loop refuses a production target
  await expectThrow("loop refuses production target", () =>
    improveOnce(new FakeLLMClient(), new FakeEmbeddingsClient(), { component: "stripe-payout", suite, runJudge: false }),
  );

  const passed = results.filter((r) => r.pass).length;
  console.log(`\nOPERATOR OS — SANITY PASS  (${passed}/${results.length})\n`);
  for (const r of results) console.log(`  ${r.pass ? "✓" : "✗"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  if (passed < results.length) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
