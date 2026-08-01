import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/authorize";
import { runDeadlineReminders } from "@/lib/db/local-store";

export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const result = await runDeadlineReminders();
  return NextResponse.json({ ok: true, ...result });
}
