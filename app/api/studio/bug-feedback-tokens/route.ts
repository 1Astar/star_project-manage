import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import {
  ensureAllFeedbackTokens,
  ensurePriorityFeedbackTokens,
  ensureProjectFeedbackToken,
  formatFeedbackTokensEnv,
  listProjectFeedbackTokens,
  rotateProjectFeedbackToken,
} from "@/lib/bugs/feedback-token";

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const items = await listProjectFeedbackTokens();
  const format = new URL(request.url).searchParams.get("format");
  if (format === "env") {
    return new NextResponse(formatFeedbackTokensEnv(items), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="star-pm-bug-feedback.env.txt"',
      },
    });
  }
  return NextResponse.json({
    items,
    envText: formatFeedbackTokensEnv(items),
  });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  if (session.role === "viewer") {
    return NextResponse.json({ error: "观看者不能改反馈 token" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      studioProjectId?: string;
      rotate?: boolean;
      ensurePriority?: boolean;
      ensureAll?: boolean;
    };

    if (body.ensureAll) {
      const results = await ensureAllFeedbackTokens();
      const items = await listProjectFeedbackTokens();
      return NextResponse.json({
        ok: true,
        results,
        items,
        envText: formatFeedbackTokensEnv(items),
      });
    }

    if (body.ensurePriority) {
      const results = await ensurePriorityFeedbackTokens();
      const items = await listProjectFeedbackTokens();
      return NextResponse.json({
        ok: true,
        results,
        items,
        envText: formatFeedbackTokensEnv(items),
      });
    }

    const studioProjectId = body.studioProjectId?.trim();
    if (!studioProjectId) {
      return NextResponse.json({ error: "studioProjectId 必填" }, { status: 400 });
    }

    if (body.rotate) {
      const token = await rotateProjectFeedbackToken(studioProjectId);
      return NextResponse.json({ token, created: true, rotated: true });
    }

    const result = await ensureProjectFeedbackToken(studioProjectId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "操作失败" },
      { status: 400 }
    );
  }
}
