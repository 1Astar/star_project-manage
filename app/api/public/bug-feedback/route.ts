import { NextResponse } from "next/server";
import { ingestBugFeedback } from "@/lib/bugs/ingest-feedback";

export const runtime = "nodejs";

const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const row = hits.get(key);
  if (!row || row.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (row.count >= limit) return false;
  row.count += 1;
  return true;
}

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function extractToken(request: Request, body: Record<string, unknown>): string {
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer) return bearer;
  const headerToken = request.headers.get("x-bug-feedback-token")?.trim();
  if (headerToken) return headerToken;
  if (typeof body.token === "string") return body.token.trim();
  return "";
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const headers = corsHeaders(request);
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const body = (await request.json()) as Record<string, unknown>;
    const token = extractToken(request, body);
    if (!token) {
      return NextResponse.json({ error: "缺少反馈 token" }, { status: 401, headers });
    }

    if (!rateLimit(`${token}:${ip}`)) {
      return NextResponse.json({ error: "提交太频繁，请稍后再试" }, { status: 429, headers });
    }

    const description =
      typeof body.description === "string"
        ? body.description
        : typeof body.text === "string"
          ? body.text
          : "";

    const result = await ingestBugFeedback({
      token,
      title: typeof body.title === "string" ? body.title : undefined,
      description,
      pagePath: typeof body.pagePath === "string" ? body.pagePath : undefined,
      pageUrl: typeof body.pageUrl === "string" ? body.pageUrl : undefined,
      appVersion: typeof body.appVersion === "string" ? body.appVersion : undefined,
      userAgent:
        typeof body.userAgent === "string"
          ? body.userAgent
          : request.headers.get("user-agent") || undefined,
      screenshotBase64:
        typeof body.screenshotBase64 === "string" ? body.screenshotBase64 : undefined,
      screenshotMimeType:
        typeof body.screenshotMimeType === "string" ? body.screenshotMimeType : undefined,
      screenshotFileName:
        typeof body.screenshotFileName === "string" ? body.screenshotFileName : undefined,
    });

    return NextResponse.json(result, { status: 201, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "提交失败";
    const status =
      /token|无效|缺少|请填写/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status, headers });
  }
}
