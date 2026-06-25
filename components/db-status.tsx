import { getProjects } from "@/lib/db";
import { pingSupabase } from "@/lib/db/supabase-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function DbStatusBanner() {
  if (!isSupabaseConfigured()) {
    const projects = await getProjects();
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>数据库：本地模式</strong>
        <span className="ml-2">
          当前 {projects.length} 个项目。Vercel 生产环境请在环境变量中配置{" "}
          <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> 后重新部署。
        </span>
      </div>
    );
  }

  const ping = await pingSupabase();
  if (!ping.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        <strong>数据库：Supabase 连接失败</strong>
        <span className="ml-2">{ping.error ?? "请检查 URL 与 Service Role Key"}</span>
      </div>
    );
  }

  if (ping.projectCount === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>数据库：Supabase 已连接，但无项目数据</strong>
        <span className="ml-2">
          请在 Supabase SQL Editor 执行{" "}
          <code className="text-xs">003_prototype_annotations_and_seed.sql</code>
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
      <strong>数据库：Supabase 已连接</strong>
      <span className="ml-2">共 {ping.projectCount} 个项目，数据持久化生效</span>
    </div>
  );
}
