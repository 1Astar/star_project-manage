import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-button";
import { ProjectBugsClient } from "@/components/project-bugs-client";
import { resolveProjectRoute } from "@/lib/project-bridge";
import {
  getProjectMembers,
  listBugsByProject,
  listProjectRequirementOptions,
} from "@/lib/db/local-store";

export default async function ProjectBugsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string; req?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio && !ctx.pmProject && !ctx.pmSlug) notFound();

  const pm = ctx.pmProject;
  if (!pm) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="text-base font-semibold text-slate-900">Bug 反馈</h2>
        <p className="mt-2 text-sm text-slate-600">
          当前项目「{ctx.studio?.title ?? id}」尚未接入 PM 需求库，暂无 Bug 数据表可写。
        </p>
        <BackLink
          fallback={`/projects/${ctx.routeId}/tasks`}
          label="← 返回需求与任务"
          className="mt-4 inline-block text-sm text-indigo-600 hover:underline"
        />
      </div>
    );
  }

  const [bugs, members, requirements] = await Promise.all([
    listBugsByProject(pm.id),
    getProjectMembers(pm.id),
    listProjectRequirementOptions(pm.id),
  ]);

  return (
    <ProjectBugsClient
      projectId={pm.id}
      projectSlug={ctx.routeId}
      bugs={bugs}
      members={members.map((m) => ({ name: m.name }))}
      requirements={requirements}
      initialShowCreate={sp.new === "1" || Boolean(sp.req)}
      initialRequirementId={sp.req?.trim() || ""}
    />
  );
}
