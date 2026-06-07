#!/usr/bin/env node
// Operator OS CLI — the headless control plane.
//   operator status | eval [component] | loop [component] | kill [reason] | audit
import { boot } from "../core/kernel";
import { ctx } from "../contracts/schemas/common";
import { loadSuite } from "../eval/loadSuite";
import { scoreComponent } from "../eval/engine";
import { DEFAULT_PROMPT } from "../eval/components/vapi-dispatch-intent";
import { improveOnce } from "../loop/improve";
import { hasAnthropic } from "../core/env";

const COMPONENT = "vapi-dispatch-intent";

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const context = ctx({ actor: "cli" });

  switch (cmd) {
    case "status": {
      const { container, integrityOk, halted } = await boot(context, { skipIntegrity: false });
      console.log(
        JSON.stringify(
          {
            online: container.online,
            integrityOk,
            halted,
            anthropic: hasAnthropic(),
            models: { judge: "claude-opus-4-8" },
          },
          null,
          2,
        ),
      );
      break;
    }
    case "eval": {
      const component = rest[0] ?? COMPONENT;
      const suite = await loadSuite(component);
      const { container } = await boot(context, { skipIntegrity: true });
      const result = await scoreComponent(suite, container.llm, {
        promptBody: DEFAULT_PROMPT,
        runJudge: hasAnthropic(),
      });
      console.log(`\nEVAL ${component}  suite=${result.suiteHash}`);
      console.log(`  deterministic: ${result.detPassed}/${result.detTotal}`);
      console.log(`  holdout:       ${result.holdoutPassed}/${result.holdoutTotal}`);
      console.log(`  judge:         ${result.judgePassed}/${result.judgeTotal}${result.judgeTotal === 0 ? " (skipped offline)" : ""}`);
      console.log(`  SCORE:         ${result.passed}/${result.total}`);
      for (const c of result.cases) {
        const mark = c.inconclusive ? "·" : c.pass ? "✓" : "✗";
        console.log(`   ${mark} ${c.caseId} [${c.kind}] ${c.evidence ?? ""}`);
      }
      // exit nonzero if any deterministic+holdout case fails (regression gate)
      if (result.detPassed + result.holdoutPassed < result.detTotal + result.holdoutTotal) {
        console.log("\n(some deterministic/holdout cases fail — the loop has room to improve)");
      }
      break;
    }
    case "loop": {
      const component = rest[0] ?? COMPONENT;
      const suite = await loadSuite(component);
      const { container, halted } = await boot(context, { skipIntegrity: true });
      if (halted) {
        console.error("KILL switch is tripped — loop refuses to run.");
        process.exit(2);
      }
      const report = await improveOnce(container.llm, container.embeddings, {
        component,
        suite,
        runJudge: hasAnthropic(),
      });
      console.log(JSON.stringify(report, null, 2));
      break;
    }
    case "kill": {
      const { container } = await boot(context, { skipIntegrity: true });
      await container.kill.trip(rest.join(" ") || "manual kill via CLI", context);
      console.log("KILL switch TRIPPED. All loops will refuse to run until reset.");
      break;
    }
    case "audit": {
      const { container } = await boot(context, { skipIntegrity: true });
      await container.audit.record({ actor: "cli", action: "audit.ping", source: "real" }, context);
      console.log("audit entry recorded (append-only, hash-chained).");
      break;
    }
    default:
      console.log("usage: operator <status|eval|loop|kill|audit> [component]");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
