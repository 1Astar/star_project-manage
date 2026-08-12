import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/authorize";
import { pushEveningAcceptanceDigest } from "@/lib/notify/daily-digest";

/**
 * 晚报 cron（上海 18:30 ≈ UTC 10:30）：
 * 待验收板块汇总 PushPlus
 */
export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  let eveningDigest: Awaited<
    ReturnType<typeof pushEveningAcceptanceDigest>
  > | null = null;
  try {
    eveningDigest = await pushEveningAcceptanceDigest({ pushEmpty: false });
  } catch (e) {
    eveningDigest = {
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
        error: e instanceof Error ? e.message : "evening digest 失败",
      },
    };
  }

  return NextResponse.json({
    ok: true,
    kind: "evening",
    eveningDigest,
  });
}
