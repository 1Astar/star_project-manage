import { NextResponse } from "next/server";
import { runDeadlineReminders } from "@/lib/db/local-store";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET ?? "dev-cron-secret";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const result = await runDeadlineReminders();
  return NextResponse.json({ ok: true, ...result });
}
