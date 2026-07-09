import Link from "next/link";
import { StudioBadge } from "@/components/studio/shell";
import { PROJECT_STATUS_LABELS } from "@/lib/studio/types";
import type { Project } from "@/lib/studio/types";

export function ProjectLibraryCard({ project }: { project: Project }) {
  const gitLabel = project.githubRepo
    ? `Git: ${project.githubRepo}`
    : project.lastCommitMessage
      ? `Git: ${project.lastCommitMessage.slice(0, 40)}`
      : "Git: 未配置";

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
    >
      <div className="flex flex-wrap items-center gap-2">
        <StudioBadge tone={project.status === "mainline" ? "mainline" : "default"}>
          {PROJECT_STATUS_LABELS[project.status]}
        </StudioBadge>
        <StudioBadge tone={project.priority === "P0" ? "p0" : project.priority === "P1" ? "default" : "muted"}>
          {project.priority}
        </StudioBadge>
      </div>
      <h2 className="mt-3 text-lg font-bold text-slate-900 group-hover:text-indigo-700">
        {project.title}
      </h2>
      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{project.positioning}</p>
      <div className="mt-4 space-y-1.5 text-xs text-slate-500">
        <div>
          <span className="text-slate-400">阶段：</span>
          {project.currentStage || "—"}
        </div>
        <div>
          <span className="text-slate-400">下一步：</span>
          {project.nextAction || "—"}
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
