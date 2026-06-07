// Append-only audit sink. The DB enforces immutability + hash-chain via trigger;
// this client only ever INSERTs. No update/delete method exists by construction.
import type { AuditSink, AuditEvent, CallContext, DbClient } from "../../contracts/index";
import { validate } from "../reliability";
import { AuditEvent as AuditEventSchema } from "../../contracts/schemas/audit";

export class DbAuditSink implements AuditSink {
  constructor(private readonly db: DbClient) {}
  async record(event: AuditEvent, ctx: CallContext): Promise<string> {
    const e = validate(AuditEventSchema, event);
    const row = await this.db.insert<{ id: number }>("audit_log", {
      actor: e.actor,
      action: e.action,
      entity_type: e.entityType ?? null,
      entity_id: e.entityId ?? null,
      before_state: e.beforeState ?? null,
      after_state: e.afterState ?? null,
      reason: e.reason ?? null,
      cost_micro_usd: e.costMicroUsd,
      approval_nonce: e.approvalNonce ?? null,
      source: e.source,
      correlation_id: e.correlationId ?? ctx.correlationId ?? null,
      // prev_hash/entry_hash are set by the DB trigger.
      entry_hash: "pending", // overwritten by trigger BEFORE INSERT
    });
    return `audit_${row.id}`;
  }
}
