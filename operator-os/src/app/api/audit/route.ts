import { NextResponse } from "next/server";
import { getRecentAudit } from "../../data";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ entries: await getRecentAudit() });
}
