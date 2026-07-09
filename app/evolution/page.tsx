import Link from "next/link";
import { WorkbenchShell } from "@/components/workbench-shell";
import { StudioBadge } from "@/components/studio/shell";
import { getAllEvolutionLogs, getProjectTitle } from "@/lib/studio/data";
import { EVOLUTION_TYPE_LABELS } from "@/lib/studio/types";

export default async function EvolutionPage() {
  const logs = [...(await getAllEvolutionLogs())].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  const logsWithProject = await Promise.all(
    logs.map(async (log) => ({
      log,
      projectName: await getProjectTitle(log.projectId),
    }))
  );

  return (
    <WorkbenchShell
      title="演进记录"
      subtitle="变化前 → 变化后 → 为什么 → 结论 — 记录想法如何演进为项目"
    >
      <div className="space-y-6">
        {logsWithProject.map(({ log, projectName }) => (
          <article
            key={log.id}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <StudioBadge>{EVOLUTION_TYPE_LABELS[log.logType]}</StudioBadge>
              <Link
                href={`/projects/${log.projectId}/evolution`}
                className="text-sm text-indigo-600 hover:underline"
              >
                {projectName}
              </Link>
              <span className="text-xs text-slate-400">
                {new Date(log.createdAt).toLocaleDateString("zh-CN")}
              </span>
            </div>
            <h2 className="mt-2 text-lg font-bold text-slate-900">{log.title}</h2>
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-xl bg-red-50/50 p-3">
                <div className="text-xs font-medium text-red-600">变化前</div>
                <p className="mt-1 text-slate-700">{log.before}</p>
              </div>
              <div className="rounded-xl bg-green-50/50 p-3">
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
        ))}
      </div>
    </WorkbenchShell>
  );
}
