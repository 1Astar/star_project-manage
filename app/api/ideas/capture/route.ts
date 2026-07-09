import { NextResponse } from "next/server";
import { captureIdeaViaGitHubIssue } from "@/lib/github/sync-ideas";
import type { IdeaCapturePayload } from "@/lib/studio/idea-capture";

function verifyCaptureSecret(request: Request): boolean {
  const expected =
    process.env.IDEAS_CAPTURE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "dev-cron-secret";
  const auth = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-ideas-capture-secret");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : auth;
  return bearer === expected || headerSecret === expected;
}

export async function POST(request: Request) {
  if (!verifyCaptureSecret(request)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as IdeaCapturePayload;
    const result = await captureIdeaViaGitHubIssue(body);
    return NextResponse.json({
      ok: true,
      message: "已创建 GitHub Issue，等待同步进入灵感收件箱",
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "提交失败";
    const status = message.includes("未配置") ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
