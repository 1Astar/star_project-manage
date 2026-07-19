import Link from "next/link";
import { StudioBadge } from "@/components/studio/shell";
import { PROJECT_STATUS_LABELS } from "@/lib/studio/types";
import type { Project } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

export function ProjectLibraryCard({
  project,
  nextActionDraft,
  depth = 0,
  parentTitle = null,
}: {
  project: Project;
  nextActionDraft?: string;
  depth?: 0 | 1;
  parentTitle?: string | null;
}) {
  const gitLabel = project.githubRepo
    ? `Git: ${project.githubRepo}`
    : project.lastCommitMessage
      ? `Git: ${project.lastCommitMessage.slice(0, 40)}`
      : "Git: 未配置";

  const next =
    project.nextAction?.trim() || project.body?.nextStep?.trim() || "";
  const nextEmpty = !next;
  const showDraft = nextEmpty && !!nextActionDraft;

  return (
    <Link
      href={`/projects/${project.id}`}
      className={cn(
        "group block rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-indigo-200 hover:shadow-md",
        depth === 1 && "border-l-4 border-l-slate-200 bg-slate-50/70"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StudioBadge tone={project.status === "mainline" ? "mainline" : "default"}>
          {PROJECT_STATUS_LABELS[project.status]}
        </StudioBadge>
        <StudioBadge tone={project.priority === "P0" ? "p0" : project.priority === "P1" ? "default" : "muted"}>
          {project.priority}
        </StudioBadge>
        {depth === 1 ? (
          <StudioBadge tone="muted">子项目</StudioBadge>
        ) : null}
      </div>
      {depth === 1 && parentTitle ? (
        <p className="mt-2 text-xs font-medium text-slate-400">↳ {parentTitle}</p>
      ) : null}
      <h2 className="mt-3 text-lg font-bold text-slate-900 group-hover:text-indigo-700">
        {project.title}
      </h2>
      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{project.positioning}</p>
      <div className="mt-4 space-y-1.5 text-xs text-slate-500">
        <div>
          <span className="text-slate-400">阶段：</span>
          {project.currentStage || "—"}
        </div>
        <div className={nextEmpty ? "rounded-md bg-amber-50 px-1.5 py-1 text-amber-800/90" : ""}>
          <span className={nextEmpty ? "text-amber-700/70" : "text-slate-400"}>下一步：</span>
          {nextEmpty ? "未填写" : next}
          {showDraft ? (
            <div className="mt-0.5 truncate text-[11px] text-amber-700/60">
              任务草稿：{nextActionDraft}
            </div>
          ) : null}
        </div>
        {project.demoUrl ? (
          <div className="truncate text-indigo-600">Demo: {project.demoUrl.replace(/^https?:\/\//, "")}</div>
        ) : null}
        <div className="truncate">{gitLabel}</div>
        <div className="text-slate-400">
          更新：{new Date(project.updatedAt).toLocaleDateString("zh-CN")}
        </div>
      </div>
    </Link>
  );
}
