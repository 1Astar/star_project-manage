import { notFound } from "next/navigation";
import {
  RecoveryCard,
  StudioBadge,
  PropertyRow,
  BodySection,
} from "@/components/studio/shell";
import { ProjectGitPanel } from "@/components/project-git-panel";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { getStudioProjectGitPreview } from "@/lib/studio/project-git";
import { PROJECT_STATUS_LABELS } from "@/lib/studio/types";

export default async function ProjectRecoveryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio && !ctx.pmBundle) notFound();

  const gitPreview = ctx.studio ? await getStudioProjectGitPreview(ctx.studio) : null;

  return (
    <div className="space-y-6">
      {ctx.studio ? (
        <>
          <RecoveryCard project={ctx.studio} gitPreview={gitPreview} />

          <div className="rounded-xl border border-slate-200 bg-white px-5 py-2">
            <PropertyRow
              label="状态"
              value={
                <StudioBadge tone={ctx.studio.status === "mainline" ? "mainline" : "default"}>
                  {PROJECT_STATUS_LABELS[ctx.studio.status]}
                </StudioBadge>
              }
            />
            <PropertyRow label="优先级" value={<StudioBadge tone={ctx.studio.priority === "P0" ? "p0" : "default"}>{ctx.studio.priority}</StudioBadge>} />
            <PropertyRow label="当前阶段" value={ctx.studio.currentStage} />
            <PropertyRow label="目标用户" value={ctx.studio.targetUser} />
            <PropertyRow label="作品集价值" value={ctx.studio.portfolioValue} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-6 py-6">
            <BodySection title="初始想法" content={ctx.studio.body.initialThought} />
            <BodySection title="为什么有这个想法" content={ctx.studio.body.whyThought} />
            <BodySection title="产品定位" content={ctx.studio.body.positioning} />
            <BodySection title="已做" content={ctx.studio.body.done} />
            <BodySection title="现在不做" content={ctx.studio.body.notDone} />
            <BodySection title="复盘记录" content={ctx.studio.body.retrospectives} />
          </div>
        </>
      ) : null}

      {ctx.pmBundle ? (
        <ProjectGitPanel project={ctx.pmBundle.project} activities={ctx.pmBundle.git_activities} />
      ) : null}
    </div>
  );
}
