import { NextResponse } from "next/server";
import { syncAllBoundProjectsGit } from "@/lib/github/sync";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET ?? "dev-cron-secret";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const result = await syncAllBoundProjectsGit();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "同步失败";
    const status = message.includes("GITHUB_TOKEN") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
