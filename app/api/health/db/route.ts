import { NextResponse } from "next/server";
import { pingSupabase } from "@/lib/db/supabase-store";
import { getSupabasePublicConfig, isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET() {
  const supabaseConfig = getSupabasePublicConfig();

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      storage: process.env.VERCEL === "1" ? "vercel-memory" : "local-file",
      supabase: {
        urlConfigured: Boolean(supabaseConfig.url),
        anonKeyConfigured: Boolean(supabaseConfig.anonKey),
        serviceRoleConfigured: supabaseConfig.serviceRoleConfigured,
      },
      hint: "未启用 Supabase：需在环境变量中设置 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  const result = await pingSupabase();
  return NextResponse.json({
    ok: result.ok,
    storage: "supabase",
    projectCount: result.projectCount,
    error: result.error,
    supabase: {
      urlConfigured: true,
      anonKeyConfigured: Boolean(supabaseConfig.anonKey),
      serviceRoleConfigured: true,
    },
    hint: result.ok
      ? undefined
      : "Supabase 已配置但连接失败：检查 Key 是否正确，并在 SQL Editor 依次执行 001_init.sql、005_git.sql、007_studio.sql",
  });
}
