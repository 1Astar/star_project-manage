import { NextResponse } from "next/server";
import {
  addCustomBugType,
  loadBugTypeCatalog,
} from "@/lib/bugs/bug-type-catalog.server";
import { listBugTypeOptions } from "@/lib/bugs/bug-type-catalog";
import { getAdminSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  try {
    const catalog = await loadBugTypeCatalog();
    return NextResponse.json({
      ok: true,
      options: listBugTypeOptions(catalog),
      catalog,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "读取失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  if (session.role === "viewer") {
    return NextResponse.json({ error: "观看者不能添加类型" }, { status: 403 });
  }
  try {
    const body = (await request.json()) as { label?: string };
    const label = body.label?.trim() ?? "";
    if (!label) {
      return NextResponse.json({ error: "请填写类型名称" }, { status: 400 });
    }
    const { catalog, entry } = await addCustomBugType(label);
    return NextResponse.json({
      ok: true,
      entry,
      options: listBugTypeOptions(catalog),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "添加失败";
    const status = /已有同名|不能为空/.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
