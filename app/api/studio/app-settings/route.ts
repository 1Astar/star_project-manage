import { NextResponse } from "next/server";
import { getAppSetting, getAppSettings, upsertAppSetting } from "@/lib/studio/app-settings";
import { getAdminSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  const keysParam = searchParams.get("keys");

  try {
    if (key) {
      const row = await getAppSetting(key);
      return NextResponse.json({ setting: row });
    }
    const keys = (keysParam ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const settings = await getAppSettings(keys);
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "读取失败" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  if (session.role === "viewer") {
    return NextResponse.json({ error: "观看者不能改全局偏好" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { key?: string; value?: unknown };
    if (!body.key?.trim()) {
      return NextResponse.json({ error: "key 必填" }, { status: 400 });
    }
    const setting = await upsertAppSetting(body.key.trim(), body.value ?? {});
    return NextResponse.json({ setting });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "保存失败" },
      { status: 500 }
    );
  }
}
