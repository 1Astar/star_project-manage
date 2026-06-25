import { NextResponse } from "next/server";
import { isSupabaseConfigured, getSupabasePublicConfig } from "@/lib/supabase/config";
import { pingSupabase } from "@/lib/db/supabase-store";
import { getProjects } from "@/lib/db";

export async function GET() {
  const publicConfig = getSupabasePublicConfig();

  if (!isSupabaseConfigured()) {
    const projects = await getProjects();
    return NextResponse.json({
      backend: "local",
      ok: true,
      projectCount: projects.length,
      supabase: {
        urlSet: Boolean(publicConfig.url),
        anonKeySet: Boolean(publicConfig.anonKey),
        serviceRoleSet: publicConfig.serviceRoleConfigured,
        message: "未启用 Supabase，使用本地 JSON 存储",
      },
    });
  }

  const ping = await pingSupabase();
  return NextResponse.json({
    backend: "supabase",
    ok: ping.ok,
    projectCount: ping.projectCount,
    error: ping.error ?? null,
    supabase: {
      urlSet: Boolean(publicConfig.url),
      anonKeySet: Boolean(publicConfig.anonKey),
      serviceRoleSet: publicConfig.serviceRoleConfigured,
      message: ping.ok
        ? "Supabase 已连接，数据持久化生效"
        : "环境变量已填但连接失败，请检查 Key 与是否已执行 SQL 迁移",
    },
  });
}
