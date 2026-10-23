import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-button";
import { ProjectWorkbookClient } from "@/components/project-workbook-client";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { listProjectWorkbooks } from "@/lib/workbooks/store";

export default async function ProjectWorkbooksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio && !ctx.pmProject && !ctx.pmSlug) notFound();

  const project = ctx.pmProject;
  if (!project) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="text-base font-semibold text-slate-900">工作簿</h2>
        <p className="mt-2 text-sm text-slate-600">
          当前项目「{ctx.studio?.title ?? id}」尚未接入 PM 需求库，暂无工作簿可写。
        </p>
        <BackLink
          fallback={`/projects/${ctx.routeId}/tasks`}
          label="← 返回需求与任务"
          className="mt-4 inline-block text-sm text-indigo-600 hover:underline"
        />
      </div>
    );
  }

  const workbooks = await listProjectWorkbooks(project.id);
  const initialWorkbooks = workbooks.map(
    ({ sheet_data: _s, ...meta }) => meta
  );

  return (
    <ProjectWorkbookClient
      projectSlug={ctx.routeId}
      initialWorkbooks={initialWorkbooks}
    />
  );
}
