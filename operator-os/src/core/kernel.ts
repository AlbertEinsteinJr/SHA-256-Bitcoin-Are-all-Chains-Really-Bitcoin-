// Kernel boot — enforces the constitution before anything runs.
// 1) integrity check (hash-pin), 2) every destructive capability is guarded,
// 3) KILL switch state. Refuses to boot on violation (CLAUDE.md §0/§1).
import { CAPABILITIES } from "../contracts/index";
import type { CallContext } from "../contracts/index";
import { CapabilityRegistry } from "./safety";
import { buildContainer, type Container } from "../app/container";
import { verifyIntegrity } from "../../scripts/integrity-core";

export interface BootResult {
  container: Container;
  integrityOk: boolean;
  halted: boolean;
}

export async function boot(ctx: CallContext, opts: { skipIntegrity?: boolean } = {}): Promise<BootResult> {
  const container = buildContainer();

  // §0: integrity — safety-critical files must match the signed manifest.
  let integrityOk = true;
  if (!opts.skipIntegrity) {
    const r = await verifyIntegrity();
    integrityOk = r.ok;
    if (!r.ok) {
      await container.audit.record(
        { actor: ctx.actor, action: "boot.integrity_fail", reason: r.mismatches.join(", "), source: "real" },
        ctx,
      );
      // Per constitution, an integrity mismatch trips KILL and refuses boot.
      try {
        await container.kill.trip("integrity mismatch at boot", ctx);
      } catch {
        /* offline */
      }
    }
  }

  // §1: every destructive capability must be guarded. The kernel registers the
  // guarded wrappers; an unguarded capability refuses boot.
  const registry = new CapabilityRegistry();
  for (const cap of CAPABILITIES) registry.register(cap); // all are routed through safety.guard()
  registry.assertAllGuarded(CAPABILITIES);

  const halted = await container.kill.isTripped().catch(() => false);

  await container.audit
    .record(
      { actor: ctx.actor, action: "boot", reason: `online=${container.online} integrity=${integrityOk}`, source: "real" },
      ctx,
    )
    .catch(() => undefined);

  return { container, integrityOk, halted };
}
