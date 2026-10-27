import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-button";
import { ProjectBugsClient } from "@/components/project-bugs-client";
import { resolveProjectRoute } from "@/lib/project-bridge";
import {
  getProjectMembers,
  listBugsByProject,
  listProjectIterations,
  listProjectRequirementOptions,
} from "@/lib/db/local-store";
import { listBugTestPlans } from "@/lib/bugs/test-plans";
import { resolveFeatureModules } from "@/lib/studio/project-modules";
import { getAdminSession } from "@/lib/auth/session";
import { PRODUCT_ASSIGNEE_NAME } from "@/lib/assignee-roster";

/**
 * 独立全页约定：URL `/bugs/[id]` 可分享/新开，界面仍是「左列表 + 右详情」分栏（同图2），
 * 不是单独整页丢列表。
 */
export default async function BugDetailPage({
  params,
}: {
  params: Promise<{ id: string; bugId: string }>;
}) {
  const { id, bugId } = await params;
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

  const [bugs, members, requirements, testPlans, iterations, session] =
    await Promise.all([
      listBugsByProject(pm.id),
      getProjectMembers(pm.id),
      listProjectRequirementOptions(pm.id),
      listBugTestPlans(pm.id, { includeArchived: true }),
      listProjectIterations(pm.id),
      getAdminSession(),
    ]);

  if (!bugs.some((b) => b.id === bugId)) notFound();

  const featureModules = resolveFeatureModules(
    ctx.studio?.id ?? pm.id,
    ctx.studio?.featureModules,
    ctx.studio?.githubRepo
  );
  const currentUserName =
    session?.role === "admin"
      ? PRODUCT_ASSIGNEE_NAME
      : session?.email?.split("@")[0]?.trim() || PRODUCT_ASSIGNEE_NAME;

  return (
    <ProjectBugsClient
      projectId={pm.id}
      projectSlug={ctx.routeId}
      projectName={pm.name}
      bugs={bugs}
      members={members.map((m) => ({ name: m.name }))}
      requirements={requirements}
      featureModules={featureModules}
      testPlans={testPlans}
      iterations={iterations}
      currentUserName={currentUserName}
      initialPeekId={bugId}
      syncPeekUrl
    />
  );
}
