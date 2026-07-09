import Link from "next/link";
import { AppBrandFooter } from "@/components/app-brand-footer";
import { appVersionLabel } from "@/lib/app-meta";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/studio", label: "Dashboard", icon: "◉" },
  { href: "/studio/mainline", label: "当前主线", icon: "★" },
  { href: "/studio/inbox", label: "灵感收件箱", icon: "✦" },
  { href: "/studio/projects", label: "项目库", icon: "▣" },
  { href: "/studio/evolution", label: "演进记录", icon: "↻" },
  { href: "/studio/parking", label: "灵感停车场", icon: "⏸" },
];

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
    <div className="flex min-h-screen bg-[#f7f7f5]">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-stone-200 bg-[#fbfbfa] p-4 md:flex">
        <div className="mb-6 px-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Idea Studio
            </div>
            <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">
              {appVersionLabel()}
            </span>
          </div>
          <div className="mt-1 text-sm font-bold text-stone-800">灵感 → 项目</div>
        </div>
        <nav className="space-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-stone-600 hover:bg-stone-100"
            >
              <span className="w-4 text-center text-xs text-stone-400">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-3 border-t border-stone-200 pt-4 px-2">
          <AppBrandFooter variant="compact" />
          <Link href="/" className="block text-xs text-stone-400 hover:text-stone-600">
            ← 返回 Star PM
          </Link>
        </div>
      </aside>

      <div className="flex-1 overflow-x-hidden">
        <header className="border-b border-stone-200 bg-white/80 px-6 py-4 backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-stone-900">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-stone-500">{subtitle}</p> : null}
            </div>
            {actions}
          </div>
        </header>
        <main className="px-6 py-6">
          {children}
          <AppBrandFooter className="mt-8 md:hidden" />
        </main>
      </div>
    </div>
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
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">项目恢复卡</div>
      <div className="mt-3 grid gap-2 text-sm">
        <div>
          <span className="text-stone-500">当前状态：</span>
          <StudioBadge tone={project.priority === "P0" ? "p0" : "p1"}>
            {project.priority} · {project.currentStage || project.status}
          </StudioBadge>
        </div>
        <div>
          <span className="text-stone-500">下一步：</span>
          {project.nextAction || project.body.nextStep || "—"}
        </div>
        {project.demoUrl ? (
          <div>
            <span className="text-stone-500">Demo：</span>
            <a href={project.demoUrl} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">
              {project.demoUrl}
            </a>
          </div>
        ) : null}
        {repoUrl ? (
          <div>
            <span className="text-stone-500">GitHub：</span>
            <a href={repoUrl} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">
              {project.githubRepo}
            </a>
          </div>
        ) : null}
        {project.vercelUrl ? (
          <div>
            <span className="text-stone-500">Vercel：</span>
            <a href={project.vercelUrl} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">
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
              <a href={gitPreview.url} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">
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
