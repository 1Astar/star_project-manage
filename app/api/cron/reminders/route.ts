import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/authorize";
import { runDeadlineReminders } from "@/lib/db/local-store";

/**
 * 早间 cron（上海 09:00 ≈ UTC 01:00）：
 * 仅期限提醒。微信日总结改到晚报两条（更新 + 待验收），此处不再 PushPlus。
 */
export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const result = await runDeadlineReminders();
  return NextResponse.json({
    ok: true,
    kind: "morning-reminders",
    ...result,
    morningDigest: { sent: false, skipped: true, reason: "日总结改晚报双推" },
  });
}
