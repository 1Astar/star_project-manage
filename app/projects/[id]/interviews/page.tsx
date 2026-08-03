import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchProjectBoard } from "@/lib/actions";
import { InterviewsClient } from "@/components/interviews-client";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { listProjectInterviews } from "@/lib/interviews/store";

export default async function ProjectInterviewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio && !ctx.pmBundle) notFound();

  const pmBundle =
    ctx.pmBundle ?? (ctx.pmSlug ? await fetchProjectBoard(ctx.pmSlug) : null);
  const project = pmBundle?.project ?? null;

  if (!project) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="text-base font-semibold text-slate-900">访谈库</h2>
        <p className="mt-2 text-sm text-slate-600">
          当前项目「{ctx.studio?.title ?? id}」尚未接入 PM 需求库，暂无访谈数据表可写。
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

  const interviews = await listProjectInterviews(project.id);

  return (
    <InterviewsClient
      projectId={project.id}
      projectSlug={ctx.routeId}
      initialInterviews={interviews}
    />
  );
}
