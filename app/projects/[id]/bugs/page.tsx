import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchProjectBoard, fetchProjectBugs } from "@/lib/actions";
import { ProjectBugsClient } from "@/components/project-bugs-client";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { getProjectMembers } from "@/lib/db/local-store";

export default async function ProjectBugsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio && !ctx.pmBundle) notFound();

  const pmBundle =
    ctx.pmBundle ?? (ctx.pmSlug ? await fetchProjectBoard(ctx.pmSlug) : null);

  if (!pmBundle) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="text-base font-semibold text-slate-900">Bug 反馈</h2>
        <p className="mt-2 text-sm text-slate-600">
          当前项目「{ctx.studio?.title ?? id}」尚未接入 PM 需求库，暂无 Bug 数据表可写。
        </p>
        <Link
          href={`/projects/${ctx.routeId}/tasks`}
          className="mt-4 inline-block text-sm text-indigo-600 hover:underline"
        >
          ← 返回需求与任务
        </Link>
      </div>
    );
  }

  const bugs = await fetchProjectBugs(pmBundle.project.id);
  const members = await getProjectMembers(pmBundle.project.id);
  const requirements = pmBundle.requirements.map((r) => ({
    id: r.id,
    title: r.title,
  }));

  return (
    <ProjectBugsClient
      projectId={pmBundle.project.id}
      projectSlug={ctx.routeId}
      bugs={bugs}
      members={members.map((m) => ({ name: m.name }))}
      requirements={requirements}
    />
  );
}
