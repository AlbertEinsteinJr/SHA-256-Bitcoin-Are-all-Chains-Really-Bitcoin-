// Safety kernel — CLAUDE.md §0/§1/§4. The token gate is the in-code check;
// the real stop is that destructive capabilities are private and only reachable
// through guard(), and the loop process holds no privileged credential.
import { createHash } from "node:crypto";
import type { AuditSink, SafetyKernel } from "../contracts/index";
import type { CallContext } from "../contracts/index";
import { ApprovalRequiredError, ConstitutionViolation } from "../contracts/index";
import type { SafetyDecision } from "../contracts/index";

const consumedNonces = new Set<string>(); // single-use ledger (Tier-2: move to DB)

function todayInTz(tz: string): string {
  // YYYYMMDD in the operator's timezone.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()).replace(/-/g, "");
}

export class DefaultSafetyKernel implements SafetyKernel {
  constructor(
    private readonly audit: AuditSink,
    private readonly tz: string = process.env.OPERATOR_TZ ?? "UTC",
  ) {}

  async requireApproval(
    action: string,
    token: string | undefined,
    ctx: CallContext,
  ): Promise<SafetyDecision> {
    const expected = `APPROVED-${action}-${todayInTz(this.tz)}`;
    const nonce = token ? createHash("sha256").update(token).digest("hex").slice(0, 16) : undefined;

    if (!token || token !== expected) {
      await this.audit.record(
        {
          actor: ctx.actor,
          action: `approval.denied:${action}`,
          reason: "missing or invalid APPROVED token",
          source: "real",
          costMicroUsd: 0,
        },
        ctx,
      );
      throw new ApprovalRequiredError(action);
    }
    if (nonce && consumedNonces.has(nonce)) {
      throw new ConstitutionViolation("approval token already consumed (single-use)", { action });
    }
    if (nonce) consumedNonces.add(nonce);
    await this.audit.record(
      { actor: ctx.actor, action: `approval.granted:${action}`, approvalNonce: nonce, source: "real" },
      ctx,
    );
    return { capability: action, allowed: true, reason: "valid token", nonce };
  }

  async guard<T>(
    capability: string,
    token: string | undefined,
    ctx: CallContext,
    fn: () => Promise<T>,
  ): Promise<T> {
    // A destructive/production capability NEVER runs without a valid token.
    await this.requireApproval(capability, token, ctx);
    return fn();
  }
}

// Capability registry: the kernel refuses to boot if a registered destructive
// capability has no guarded wrapper (CLAUDE.md §1: missing gate ⇒ STOP).
export class CapabilityRegistry {
  private readonly guarded = new Set<string>();
  register(capability: string) {
    this.guarded.add(capability);
  }
  assertAllGuarded(required: readonly string[]) {
    const missing = required.filter((c) => !this.guarded.has(c));
    if (missing.length > 0) {
      throw new ConstitutionViolation(
        `destructive capabilities lack a guard wrapper: ${missing.join(", ")}`,
        { missing },
      );
    }
  }
}
