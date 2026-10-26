import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-button";
import { ProjectResearchWorkbench } from "@/components/project-research-workbench";
import { resolveProjectRoute } from "@/lib/project-bridge";
import {
  listLearningAttachmentsForProject,
  listProjectLearningNotes,
} from "@/lib/learning-notes/store";
import { listCompetitorEntries } from "@/lib/competitors/store";
import { listProjectPrds } from "@/lib/prds/store";
import {
  getPoolBundle,
  listBoardRequirementsByProject,
  listBugAttachmentsByProject,
  listBugsByProject,
  listProjectAttachments,
  listProjectModules,
} from "@/lib/db/local-store";
import { buildOverviewMatrixRows } from "@/lib/overview/matrix-rows";
import { buildOverviewRelationIndex } from "@/lib/overview/relations";
import {
  isImageAttachment,
  pickThumbnails,
  type OverviewThumbnail,
} from "@/lib/overview/thumbnails";

function buildThumbMaps(
  learningAtts: Array<{
    note_id: string;
    url: string;
    title?: string | null;
    mime_type?: string | null;
  }>,
  bugAtts: Array<{
    bug_id: string;
    url: string;
    title?: string | null;
    mime_type?: string | null;
  }>,
  reqAtts: Array<{
    requirement_id: string;
    url: string;
    title?: string | null;
    mime_type?: string | null;
  }>
) {
  const thumbsByEntityId = new Map<string, OverviewThumbnail[]>();
  const attachmentCountByEntityId = new Map<string, number>();

  const bump = (
    entityId: string,
    list: Array<{ url: string; title?: string | null; mime_type?: string | null }>
  ) => {
    const images = list.filter(isImageAttachment);
    if (!images.length) return;
    attachmentCountByEntityId.set(
      entityId,
      (attachmentCountByEntityId.get(entityId) ?? 0) + images.length
    );
    const existing = thumbsByEntityId.get(entityId) ?? [];
    const more = pickThumbnails(images, 2 - existing.length);
    if (more.length) thumbsByEntityId.set(entityId, [...existing, ...more]);
  };

  const byNote = new Map<string, typeof learningAtts>();
  for (const a of learningAtts) {
    const list = byNote.get(a.note_id) ?? [];
    list.push(a);
    byNote.set(a.note_id, list);
  }
  for (const [id, list] of byNote) bump(id, list);

  const byBug = new Map<string, typeof bugAtts>();
  for (const a of bugAtts) {
    const list = byBug.get(a.bug_id) ?? [];
    list.push(a);
    byBug.set(a.bug_id, list);
  }
  for (const [id, list] of byBug) bump(id, list);

  const byReq = new Map<string, typeof reqAtts>();
  for (const a of reqAtts) {
    const list = byReq.get(a.requirement_id) ?? [];
    list.push(a);
    byReq.set(a.requirement_id, list);
  }
  for (const [id, list] of byReq) bump(id, list);

  return { thumbsByEntityId, attachmentCountByEntityId };
}

/**
 * 调研工作台：统计 / 待处理 / 最近更新 + 六类筛选卡片 + 总览表。
 * 刻意轻量拉取，避免概况旧版一次打满 Worker 导致 Application error。
 */
export default async function ProjectOverviewPage({
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
        <h2 className="text-base font-semibold text-slate-900">调研工作台</h2>
        <p className="mt-2 text-sm text-slate-600">
          当前项目「{ctx.studio?.title ?? id}」尚未接入 PM 需求库，暂无总览可写。
        </p>
        <BackLink
          fallback={`/projects/${ctx.routeId}/tasks`}
          label="← 返回需求与任务"
          className="mt-4 inline-block text-sm text-indigo-600 hover:underline"
        />
      </div>
    );
  }

  const projectSlug = ctx.pmSlug ?? project.slug;
  const [
    learnings,
    bugs,
    competitors,
    pool,
    boardReqs,
    modules,
    learningAtts,
    bugAtts,
    reqAtts,
    prds,
  ] = await Promise.all([
    listProjectLearningNotes(project.id),
    listBugsByProject(project.id),
    listCompetitorEntries(project.id),
    getPoolBundle(project.id),
    listBoardRequirementsByProject(project.id),
    listProjectModules(project.id),
    listLearningAttachmentsForProject(project.id),
    listBugAttachmentsByProject(project.id),
    listProjectAttachments(project.id),
    listProjectPrds(project.id),
  ]);

  const byId = new Map(
    [...(pool?.poolRequirements ?? []), ...boardReqs].map((r) => [r.id, r])
  );
  const requirements = Array.from(byId.values());
  const { thumbsByEntityId, attachmentCountByEntityId } = buildThumbMaps(
    learningAtts,
    bugAtts,
    reqAtts
  );

  const rows = buildOverviewMatrixRows({
    routeId: ctx.routeId,
    learnings,
    bugs,
    competitors,
    requirements,
    modules,
    thumbsByEntityId,
    attachmentCountByEntityId,
  });

  const relationIndex = buildOverviewRelationIndex({
    routeId: ctx.routeId,
    projectSlug,
    rows,
    learnings,
    bugs,
    competitors,
    requirements,
    prds,
  });

  return (
    <ProjectResearchWorkbench
      projectSlug={projectSlug}
      projectTitle={ctx.studio?.title ?? project.name}
      rows={rows}
      bugs={bugs}
      requirements={requirements}
      relationIndex={relationIndex}
    />
  );
}
