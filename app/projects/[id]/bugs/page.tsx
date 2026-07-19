import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchProjectBoard, fetchProjectBugs } from "@/lib/actions";
import { ProjectBugsClient } from "@/components/project-bugs-client";
import { resolveProjectRoute } from "@/lib/project-bridge";

export default async function ProjectBugsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio && !ctx.pmBundle) notFound();

  const slug = ctx.pmSlug ?? id;
  const pmBundle =
    ctx.pmBundle ?? (ctx.pmSlug ? await fetchProjectBoard(ctx.pmSlug) : null);

  // Studio 项目未映射到 PM 时，不再 404，给出可理解的空态
  if (!pmBundle) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="text-base font-semibold text-slate-900">Bug 反馈</h2>
        <p className="mt-2 text-sm text-slate-600">
          当前项目「{ctx.studio?.title ?? id}」尚未接入 PM 需求库，暂无 Bug 数据表可写。
        </p>
        <p className="mt-2 text-sm text-slate-500">
          已映射的项目（如 Star PM / AI 宠物）可直接在本页提交与跟踪 Bug。需要的话可在项目桥接里补上映射。
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

  return (
    <ProjectBugsClient
      projectId={pmBundle.project.id}
      projectSlug={ctx.routeId}
      bugs={bugs}
    />
  );
}
