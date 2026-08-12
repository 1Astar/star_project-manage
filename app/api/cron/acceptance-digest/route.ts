import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/authorize";
import { pushEveningDailySummaries } from "@/lib/notify/daily-digest";

/**
 * 晚报 cron（上海 18:30 ≈ UTC 10:30）：
 * 分两条 PushPlus：① 今日更新 ② 待验收（空则跳过）
 */
export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const result = await pushEveningDailySummaries({ pushEmpty: false });
    return NextResponse.json({
      ok: true,
      kind: "evening",
      updatesDigest: result.updates,
      eveningDigest: result.acceptance,
      acceptanceDigest: result.acceptance,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        kind: "evening",
        error: e instanceof Error ? e.message : "evening digest 失败",
      },
      { status: 500 },
    );
  }
}
