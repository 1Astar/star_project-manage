import Link from "next/link";
import { StudioShell, StudioBadge } from "@/components/studio/shell";
import { getAllProjects } from "@/lib/studio/data";
import { PROJECT_STATUS_LABELS } from "@/lib/studio/types";

export default async function ProjectsPage() {
  const projects = [...(await getAllProjects())].sort((a, b) => {
    const order = { mainline: 0, active: 1, demo: 2, parking: 3, archived: 4 };
    return order[a.status] - order[b.status] || a.priority.localeCompare(b.priority);
  });

  return (
    <StudioShell title="项目库" subtitle="真正准备推进的项目才进这里">
      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/studio/projects/${p.id}`}
            className="group rounded-lg border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-300 hover:shadow"
          >
            <div className="flex flex-wrap items-center gap-2">
              <StudioBadge tone={p.status === "mainline" ? "mainline" : "default"}>
                {PROJECT_STATUS_LABELS[p.status]}
              </StudioBadge>
              <StudioBadge tone={p.priority === "P0" ? "p0" : p.priority === "P1" ? "p1" : "muted"}>
                {p.priority}
              </StudioBadge>
            </div>
            <h2 className="mt-3 text-lg font-bold text-stone-900 group-hover:text-blue-700">
              {p.title}
            </h2>
            <p className="mt-1 line-clamp-2 text-sm text-stone-500">{p.positioning}</p>
            <div className="mt-3 text-xs text-stone-400">
              <div>阶段：{p.currentStage}</div>
              <div className="mt-1">下一步：{p.nextAction}</div>
            </div>
            {p.portfolioValue ? (
              <p className="mt-2 text-xs text-stone-400">作品集：{p.portfolioValue}</p>
            ) : null}
          </Link>
        ))}
      </div>
    </StudioShell>
  );
}
