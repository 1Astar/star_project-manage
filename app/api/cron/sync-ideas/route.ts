import { NextResponse } from "next/server";
import { syncIdeasFromGitHub } from "@/lib/github/sync-ideas";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET ?? "dev-cron-secret";
  if (authHeader !== `Bearer ${cronSecret}`) {
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
