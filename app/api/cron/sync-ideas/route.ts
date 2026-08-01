import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron/authorize";
import { syncIdeasFromGitHub } from "@/lib/github/sync-ideas";

export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const result = await syncIdeasFromGitHub();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "同步失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
