import { Suspense } from "react";
import Link from "next/link";
import { WorkbenchShell } from "@/components/workbench-shell";
import { GlobalRequirementBoard } from "@/components/global-requirement-board";
import { getAdminSession } from "@/lib/auth/session";
import { getAllRequirementsBoard } from "@/lib/db/local-store";

export default async function GlobalRequirementsBoardPage() {
  const session = await getAdminSession();
  const { items, projects } = await getAllRequirementsBoard();

  return (
    <WorkbenchShell
      title="需求总览"
      subtitle="看板 / 表格切换 · 跨项目叶子需求 · 可按项目筛选"
      role={session?.role}
      actions={
        <Link href="/todos" className="text-sm text-indigo-600 hover:underline">
          我的待办 →
        </Link>
      }
    >
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <Suspense fallback={<div className="h-40 rounded-xl bg-slate-50" />}>
          <GlobalRequirementBoard initialItems={items} projects={projects} />
        </Suspense>
      </div>
    </WorkbenchShell>
  );
}
