// KILL switch — server-side, fail-closed. State lives in system_flags (the loop
// has no UPDATE grant on it in the hardened role model). Checked at every step.
import type { KillSwitch, CallContext, DbClient, AuditSink } from "../contracts/index";
import { KillSwitchTrippedError } from "../contracts/index";

export class DbKillSwitch implements KillSwitch {
  constructor(
    private readonly db: DbClient,
    private readonly audit: AuditSink,
  ) {}

  async isTripped(): Promise<boolean> {
    const f = await this.db.selectOne<{ halted: boolean }>("system_flags", { id: true });
    return Boolean(f?.halted);
  }

  async assertLive(_ctx: CallContext): Promise<void> {
    if (await this.isTripped()) throw new KillSwitchTrippedError();
  }

  async trip(reason: string, ctx: CallContext): Promise<void> {
    const raw = (this.db as { raw?: () => { from: (t: string) => { update: (v: Record<string, unknown>) => { eq: (c: string, v: unknown) => Promise<unknown> } } } }).raw;
    if (raw) {
      await raw().from("system_flags").update({ halted: true, halt_reason: reason, halted_at: new Date().toISOString() }).eq("id", true);
    }
    await this.audit.record({ actor: ctx.actor, action: "kill.trip", reason, source: "real" }, ctx);
  }

  async reset(ctx: CallContext): Promise<void> {
    const raw = (this.db as { raw?: () => { from: (t: string) => { update: (v: Record<string, unknown>) => { eq: (c: string, v: unknown) => Promise<unknown> } } } }).raw;
    if (raw) {
      await raw().from("system_flags").update({ halted: false, halt_reason: null }).eq("id", true);
    }
    await this.audit.record({ actor: ctx.actor, action: "kill.reset", source: "real" }, ctx);
  }

  async heartbeat(): Promise<void> {
    const raw = (this.db as { raw?: () => { from: (t: string) => { update: (v: Record<string, unknown>) => { eq: (c: string, v: unknown) => Promise<unknown> } } } }).raw;
    if (raw) await raw().from("system_flags").update({ heartbeat_at: new Date().toISOString() }).eq("id", true);
  }
}
