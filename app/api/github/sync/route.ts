import { NextResponse } from "next/server";
import { syncProjectGit } from "@/lib/github/sync";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "缺少 projectId 参数" }, { status: 400 });
  }

  try {
    const result = await syncProjectGit(projectId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "同步失败";
    const status = message.includes("不存在") || message.includes("未绑定") || message.includes("未配置")
      ? 400
      : message.includes("GITHUB_TOKEN")
        ? 503
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
