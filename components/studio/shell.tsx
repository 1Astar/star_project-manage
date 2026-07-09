import Link from "next/link";
import { WorkbenchShell } from "@/components/workbench-shell";
import { cn } from "@/lib/utils";

/** @deprecated 使用 WorkbenchShell；保留别名便于渐进迁移 */
export function StudioShell({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <WorkbenchShell title={title} subtitle={subtitle} actions={actions}>
      {children}
    </WorkbenchShell>
  );
}

export function PropertyRow({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-[120px_1fr] gap-3 border-b border-stone-100 py-2 text-sm", className)}>
      <div className="text-stone-400">{label}</div>
      <div className="text-stone-800">{value || "—"}</div>
    </div>
  );
}

export function StudioBadge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "mainline" | "p0" | "p1" | "success" | "muted" | "warning";
}) {
  const tones = {
    default: "bg-stone-100 text-stone-700",
    mainline: "bg-amber-100 text-amber-800",
    p0: "bg-red-100 text-red-700",
    p1: "bg-blue-100 text-blue-700",
    success: "bg-green-100 text-green-700",
    muted: "bg-stone-50 text-stone-500",
    warning: "bg-orange-100 text-orange-700",
  };
  return (
    <span className={cn("inline-flex rounded px-2 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function BodySection({ title, content }: { title: string; content: string }) {
  if (!content?.trim()) return null;
  return (
    <section className="mt-8">
      <h3 className="mb-2 text-sm font-semibold text-stone-500">{title}</h3>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800">{content}</div>
    </section>
  );
}

export function RecoveryCard({
  project,
  gitPreview,
}: {
  project: import("@/lib/studio/types").Project;
  gitPreview?: { message: string; url: string | null; date: string | null } | null;
}) {
  const latest = gitPreview?.message ?? getLatestProgress(project);
  const repoUrl = project.githubRepo ? `https://github.com/${project.githubRepo}` : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">项目恢复卡</div>
      <div className="mt-4 grid gap-3 text-sm">
        <div>
          <span className="text-slate-500">当前状态：</span>
          <StudioBadge tone={project.status === "mainline" ? "mainline" : project.priority === "P0" ? "p0" : "default"}>
            {project.priority} · {project.currentStage || project.status}
          </StudioBadge>
        </div>
        <div>
          <span className="text-slate-500">下一步：</span>
          <span className="font-medium text-slate-800">{project.nextAction || project.body.nextStep || "—"}</span>
        </div>
        {project.demoUrl ? (
          <div>
            <span className="text-stone-500">Demo：</span>
            <a href={project.demoUrl} className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer">
              {project.demoUrl}
            </a>
          </div>
        ) : null}
        {repoUrl ? (
          <div>
            <span className="text-stone-500">GitHub：</span>
            <a href={repoUrl} className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer">
              {project.githubRepo}
            </a>
          </div>
        ) : null}
        {project.vercelUrl ? (
          <div>
            <span className="text-stone-500">Vercel：</span>
            <a href={project.vercelUrl} className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer">
              {project.vercelUrl}
            </a>
          </div>
        ) : null}
        {project.localRunGuide ? (
          <div>
            <span className="text-stone-500">本地启动：</span>
            <pre className="mt-1 rounded bg-white/80 p-2 text-xs text-stone-700 whitespace-pre-wrap">
              {project.localRunGuide}
            </pre>
          </div>
        ) : null}
        {latest ? (
          <div>
            <span className="text-stone-500">最近 Git 更新：</span>
            {gitPreview?.url ? (
              <a href={gitPreview.url} className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer">
                {latest}
              </a>
            ) : (
              latest
            )}
          </div>
        ) : null}
        {project.body.notDone ? (
          <div>
            <span className="text-stone-500">暂时不做：</span>
            <span className="text-stone-600">{project.body.notDone}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getLatestProgress(project: import("@/lib/studio/types").Project) {
  return project.body.done?.split("\n").filter(Boolean).pop() ?? null;
}
