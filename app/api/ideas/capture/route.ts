import { NextResponse } from "next/server";
import { captureIdea } from "@/lib/studio/capture-idea";
import { CaptureDuplicateError } from "@/lib/studio/capture-relation";
import type { IdeaCapturePayload } from "@/lib/studio/idea-capture";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-ideas-capture-secret",
};

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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  if (!verifyCaptureSecret(request)) {
    return NextResponse.json({ error: "未授权" }, { status: 401, headers: CORS_HEADERS });
  }

  try {
    const body = (await request.json()) as IdeaCapturePayload;
    const result = await captureIdea(body);
    return NextResponse.json(
      {
        ok: true,
        message: result.parentAutoLinked
          ? `已进入灵感收件箱，并自动挂父：${result.parentLinkReason}`
          : "已进入灵感收件箱",
        ...result,
      },
      { headers: CORS_HEADERS },
    );
  } catch (error) {
    if (error instanceof CaptureDuplicateError) {
      return NextResponse.json(
        {
          ok: false,
          code: "DUPLICATE",
          error: error.message,
          candidates: error.candidates,
          hint: "请 update_idea，或 force:true 强制新建",
        },
        { status: 409, headers: CORS_HEADERS },
      );
    }
    const message = error instanceof Error ? error.message : "提交失败";
    return NextResponse.json({ error: message }, { status: 400, headers: CORS_HEADERS });
  }
}
