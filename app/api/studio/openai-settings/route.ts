import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import {
  clearServerOpenAiSettings,
  loadServerOpenAiSettings,
  saveServerOpenAiSettings,
} from "@/lib/studio/ai/openai-server-settings";
import { maskApiKey } from "@/lib/studio/ai/openai-settings";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const settings = await loadServerOpenAiSettings();
  if (!settings) {
    return NextResponse.json({ configured: false, settings: null });
  }

  return NextResponse.json({
    configured: true,
    settings: {
      model: settings.model,
      baseUrl: settings.baseUrl,
      apiKeyMasked: maskApiKey(settings.apiKey),
      updatedAt: settings.updatedAt ?? null,
    },
  });
}

export async function PUT(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  if (session.role === "viewer") {
    return NextResponse.json({ error: "观看者不能改模型配置" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      apiKey?: string;
      model?: string;
      baseUrl?: string;
      clear?: boolean;
    };

    if (body.clear) {
      await clearServerOpenAiSettings();
      return NextResponse.json({ configured: false });
    }

    const saved = await saveServerOpenAiSettings({
      apiKey: body.apiKey ?? "",
      model: body.model ?? "",
      baseUrl: body.baseUrl,
    });

    return NextResponse.json({
      configured: true,
      settings: {
        model: saved.model,
        baseUrl: saved.baseUrl,
        apiKeyMasked: maskApiKey(saved.apiKey),
        updatedAt: saved.updatedAt ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存失败" },
      { status: 400 }
    );
  }
}
