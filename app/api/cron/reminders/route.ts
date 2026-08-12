import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/authorize";
import { runDeadlineReminders } from "@/lib/db/local-store";
import { pushMorningWorkbenchDigest } from "@/lib/notify/daily-digest";

/**
 * 早报 cron（上海 09:00 ≈ UTC 01:00）：
 * 期限提醒 + 今日要做 / 推荐 PushPlus
 */
export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const result = await runDeadlineReminders();
  let morningDigest: Awaited<ReturnType<typeof pushMorningWorkbenchDigest>> | null =
    null;
  try {
    morningDigest = await pushMorningWorkbenchDigest({ pushEmpty: false });
  } catch (e) {
    morningDigest = {
      sent: false,
      total: 0,
      sections: {
        todayDay: "",
        acceptance: [],
        gitSync: [],
        todayTodos: [],
        yesterdayOpen: [],
        hubHref: "",
      },
      push: {
        ok: false,
        error: e instanceof Error ? e.message : "morning digest 失败",
      },
    };
  }
  return NextResponse.json({
    ok: true,
    kind: "morning",
    ...result,
    morningDigest,
    /** 兼容旧字段名 */
    dailyDigest: morningDigest,
    acceptanceDigest: {
      sent: morningDigest.sent,
      count: morningDigest.total,
      push: morningDigest.push,
    },
  });
}
