import { describe, it, expect } from "vitest";
import { DefaultSafetyKernel } from "./safety";
import { RecordingAuditSink } from "../contracts/testing/index";
import { ctx } from "../contracts/schemas/common";

const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, "");

describe("safety kernel (§0/§1/§4)", () => {
  it("rejects an action with no token and audits the denial", async () => {
    const audit = new RecordingAuditSink();
    const k = new DefaultSafetyKernel(audit, "UTC");
    await expect(k.requireApproval("db.delete", undefined, ctx({ actor: "cli" }))).rejects.toThrow(/APPROVED/);
    expect(audit.events.some((e) => e.action.startsWith("approval.denied"))).toBe(true);
  });
  it("accepts the exact dated token", async () => {
    const k = new DefaultSafetyKernel(new RecordingAuditSink(), "UTC");
    const d = await k.requireApproval("db.delete", `APPROVED-db.delete-${today()}`, ctx({ actor: "cli" }));
    expect(d.allowed).toBe(true);
  });
  it("guard refuses to run a destructive op without a token", async () => {
    const k = new DefaultSafetyKernel(new RecordingAuditSink(), "UTC");
    let ran = false;
    await expect(
      k.guard("stripe.payout", undefined, ctx({ actor: "loop" }), async () => {
        ran = true;
        return "paid";
      }),
    ).rejects.toThrow();
    expect(ran).toBe(false);
  });
});
