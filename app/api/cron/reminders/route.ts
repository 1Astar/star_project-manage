import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/authorize";
import { runDeadlineReminders } from "@/lib/db/local-store";
import { pushAcceptanceDigest } from "@/lib/notify/acceptance-flow";

export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const result = await runDeadlineReminders();
  let acceptanceDigest: Awaited<ReturnType<typeof pushAcceptanceDigest>> | null =
    null;
  try {
    acceptanceDigest = await pushAcceptanceDigest();
  } catch (e) {
    acceptanceDigest = {
      sent: false,
      count: 0,
      push: {
        ok: false,
        error: e instanceof Error ? e.message : "acceptance digest 失败",
      },
    };
  }
  return NextResponse.json({ ok: true, ...result, acceptanceDigest });
}
