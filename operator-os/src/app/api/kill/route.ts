import { NextResponse } from "next/server";
import { buildContainer } from "../../container";
import { ctx } from "../../../contracts/schemas/common";

export const dynamic = "force-dynamic";

// Trip is easy (fail-closed, no token). Reset requires an APPROVED-kill.reset-<date> token.
export async function POST(req: Request) {
  const c = buildContainer();
  const context = ctx({ actor: "api" });
  const body = (await req.json().catch(() => ({}))) as { action?: string; reason?: string; token?: string };

  if (body.action === "reset") {
    try {
      await c.safety.requireApproval("kill.reset", body.token, context);
      await c.kill.reset(context);
      return NextResponse.json({ ok: true, halted: false });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 403 });
    }
  }
  await c.kill.trip(body.reason ?? "dashboard kill", context);
  return NextResponse.json({ ok: true, halted: true });
}
