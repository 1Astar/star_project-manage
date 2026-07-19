import Link from "next/link";
import { StudioBadge } from "@/components/studio/shell";
import type { ActiveWorkGroup } from "@/lib/workbench/progress";

function sourceLabel(source: "pm" | "studio") {
  return source === "pm" ? "PM" : "Studio";
}

export function WorkbenchActiveRequirements({ groups }: { groups: ActiveWorkGroup[] }) {
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">各项目进行中的需求</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            PM 已入迭代 · Studio 进行中 · 共 {total} 条
          </p>
        </div>
        <Link href="/projects" className="text-xs text-indigo-600 hover:underline">
          项目库 →
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">当前没有进行中的需求</p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.projectId}>
              <div className="mb-2 flex items-center gap-2">
                <Link
                  href={`/projects/${group.projectId}/tasks`}
                  className="text-sm font-semibold text-slate-800 hover:text-indigo-700"
                >
                  {group.projectTitle}
                </Link>
                <span className="text-xs text-slate-400">{group.items.length}</span>
              </div>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-100">
                {group.items.map((item) => (
                  <li key={`${item.source}-${item.id}`}>
                    <Link
                      href={item.href}
                      className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm transition hover:bg-slate-50"
                    >
                      <span className="min-w-0 flex-1 font-medium text-slate-800">
                        {item.title}
                      </span>
                      <StudioBadge tone={item.priority === "P0" ? "p0" : "default"}>
                        {item.priority ?? "—"}
                      </StudioBadge>
                      <StudioBadge tone="muted">{item.statusLabel}</StudioBadge>
                      <StudioBadge>{sourceLabel(item.source)}</StudioBadge>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
