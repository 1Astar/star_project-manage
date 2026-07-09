import Link from "next/link";
import { notFound } from "next/navigation";
import { StudioBadge } from "@/components/studio/shell";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { getProjectEvolution } from "@/lib/studio/data";
import { EVOLUTION_TYPE_LABELS } from "@/lib/studio/types";

export default async function ProjectEvolutionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio) notFound();

  const evolution = await getProjectEvolution(ctx.studio.id);

  return (
    <div className="space-y-4">
      {evolution.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          暂无迭代记录。Idea 转项目或手动添加演进后会出现在这里。
        </p>
      ) : (
        evolution.map((log) => (
          <article key={log.id} className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center gap-2">
              <StudioBadge>{EVOLUTION_TYPE_LABELS[log.logType]}</StudioBadge>
              <span className="text-xs text-slate-400">
                {new Date(log.createdAt).toLocaleDateString("zh-CN")}
              </span>
            </div>
            <h2 className="mt-2 text-lg font-bold text-slate-900">{log.title}</h2>
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-xl bg-red-50 p-3">
                <div className="text-xs font-medium text-red-600">变化前</div>
                <p className="mt-1 text-slate-700">{log.before || "—"}</p>
              </div>
              <div className="rounded-xl bg-green-50 p-3">
                <div className="text-xs font-medium text-green-600">变化后</div>
                <p className="mt-1 text-slate-700">{log.after}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              <span className="text-slate-400">为什么：</span>
              {log.reason}
            </p>
            <p className="mt-2 text-sm font-medium text-slate-800">
              <span className="font-normal text-slate-400">结论：</span>
              {log.decision}
            </p>
          </article>
        ))
      )}
      <Link href="/evolution" className="inline-block text-sm text-indigo-600 hover:underline">
        查看全局演进记录 →
      </Link>
    </div>
  );
}
