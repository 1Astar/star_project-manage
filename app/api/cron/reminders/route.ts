import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/authorize";
import { runDeadlineReminders } from "@/lib/db/local-store";
import { pushDailyWorkbenchDigest } from "@/lib/notify/daily-digest";

export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const result = await runDeadlineReminders();
  let dailyDigest: Awaited<ReturnType<typeof pushDailyWorkbenchDigest>> | null =
    null;
  try {
    dailyDigest = await pushDailyWorkbenchDigest({ pushEmpty: false });
  } catch (e) {
    dailyDigest = {
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
        error: e instanceof Error ? e.message : "daily digest 失败",
      },
    };
  }
  return NextResponse.json({
    ok: true,
    ...result,
    dailyDigest,
    /** 兼容旧字段名 */
    acceptanceDigest: {
      sent: dailyDigest.sent,
      count: dailyDigest.total,
      push: dailyDigest.push,
    },
  });
}
