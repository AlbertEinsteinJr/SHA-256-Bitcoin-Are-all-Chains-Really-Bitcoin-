// Atomic, Postgres-enforced caps (in-memory counters are unfixable under
// concurrency). Spend uses reserve-then-settle via DB functions.
import type { CapsEnforcer, CapDecision, CapKind, CallContext, DbClient } from "../contracts/index";

export class DbCapsEnforcer implements CapsEnforcer {
  constructor(
    private readonly db: DbClient,
    private readonly ratePerMin: number,
  ) {}

  async check(kind: CapKind, _amount: number, _ctx: CallContext): Promise<CapDecision> {
    if (kind === "requests") {
      const rows = await this.recentCalls();
      return { allowed: rows < this.ratePerMin, remaining: this.ratePerMin - rows, limit: this.ratePerMin };
    }
    const b = await this.db.selectOne<{ cap_micro_usd: number; spent_micro_usd: number; reserved_micro_usd: number }>(
      "budget",
      { id: true },
    );
    if (!b) return { allowed: true, remaining: 0, limit: 0 };
    const used = Number(b.spent_micro_usd) + Number(b.reserved_micro_usd);
    return { allowed: used < Number(b.cap_micro_usd), remaining: Number(b.cap_micro_usd) - used, limit: Number(b.cap_micro_usd) };
  }

  private async recentCalls(): Promise<number> {
    // windowed count via rpc would be ideal; approximate with a simple rpc helper.
    try {
      const n = await this.db.rpc<number>("recent_call_count", { p_seconds: 60 });
      return Number(n ?? 0);
    } catch {
      return 0;
    }
  }

  async reserve(amountMicroUsd: number, _ctx: CallContext): Promise<boolean> {
    return Boolean(await this.db.rpc<boolean>("reserve_spend", { p_amount: amountMicroUsd }));
  }

  async settle(reservedMicroUsd: number, actualMicroUsd: number, _ctx: CallContext): Promise<void> {
    await this.db.rpc("settle_spend", { p_reserved: reservedMicroUsd, p_actual: actualMicroUsd });
  }
}
