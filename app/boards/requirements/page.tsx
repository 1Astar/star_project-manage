import { Suspense } from "react";
import Link from "next/link";
import { WorkbenchShell } from "@/components/workbench-shell";
import { GlobalRequirementBoard } from "@/components/global-requirement-board";
import { getAdminSession } from "@/lib/auth/session";
import { getAllRequirementsBoard } from "@/lib/db/local-store";

/** 读库页：勿在 CF 构建期静态预渲染（运行时才有 Supabase 密钥） */
export const dynamic = "force-dynamic";

export default async function GlobalRequirementsBoardPage() {
  const session = await getAdminSession();
  let items: Awaited<ReturnType<typeof getAllRequirementsBoard>>["items"] = [];
  let projects: Awaited<ReturnType<typeof getAllRequirementsBoard>>["projects"] =
    [];
  let loadError: string | null = null;

  try {
    const board = await Promise.race([
      getAllRequirementsBoard(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("需求总览加载超时")), 12_000)
      ),
    ]);
    items = board.items;
    projects = board.projects;
  } catch (e) {
    console.error("boards/requirements", e);
    loadError = e instanceof Error ? e.message : "加载失败";
  }

  return (
    <WorkbenchShell
      title="需求总览"
      subtitle="多条件筛选 · 存视图 · 看板/表格切换"
      role={session?.role ?? "guest"}
      actions={
        <Link href="/todos" className="text-sm text-indigo-600 hover:underline">
          今日要做 →
        </Link>
      }
    >
      {loadError ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          需求总览暂时加载失败（{loadError}）。请刷新重试；勿连续猛刷以免拖垮站点。
        </p>
      ) : null}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <Suspense fallback={<div className="h-40 rounded-xl bg-slate-50" />}>
          <GlobalRequirementBoard initialItems={items} projects={projects} />
        </Suspense>
      </div>
    </WorkbenchShell>
  );
}
