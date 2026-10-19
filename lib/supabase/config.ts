import {
  isNextProductionBuild,
  isProductionLikeRuntime,
} from "@/lib/runtime/serverless";

/** 服务端持久化需要 URL + Service Role Key */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

/** Fail fast on Cloudflare/Vercel when Supabase is missing (no in-memory prod fallback). */
export function assertDurableStorage(): void {
  // 构建期密钥可能只存在于 Worker 运行时；预渲染勿因此整包失败
  if (isNextProductionBuild()) return;
  if (isProductionLikeRuntime() && !isSupabaseConfigured()) {
    throw new Error(
      "生产部署须配置 Supabase（NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY）。" +
        "Cloudflare Workers / Vercel 不支持 data/db.json 或内存库。"
    );
  }
}

export function getSupabasePublicConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? null,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? null,
    serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
  };
}
