import { NextResponse } from "next/server";
import { syncIdeasFromGitHub } from "@/lib/github/sync-ideas";

function verifyCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET ?? "dev-cron-secret";
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
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
