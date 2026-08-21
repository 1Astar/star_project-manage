import { WorkbenchShell } from "@/components/workbench-shell";
import { WorkbenchFocusScroll } from "@/components/workbench-focus-scroll";
import { WorkbenchHomeClient } from "@/components/workbench-home-client";
import { getAdminSession } from "@/lib/auth/session";

/**
 * 瘦 SSR：只出壳 + 会话；区块经 /api/workbench/home?part= 分段加载，
 * 避免一次请求把主线/星图/清单全塞进 Worker（1102）。
 */
export default async function WorkbenchPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; focus?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const session = await getAdminSession();

  return (
    <WorkbenchShell
      title="今日工作台"
      subtitle="日历 · 项目 · 今日 / 明日"
      role={session?.role ?? "guest"}
    >
      <WorkbenchFocusScroll focus={params.focus} />
      {params.error === "keys-forbidden" ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          密钥区仅管理员可见。公开演示不展示密钥入口；需要时请右上角登录。
        </p>
      ) : null}
      <WorkbenchHomeClient />
    </WorkbenchShell>
  );
}
