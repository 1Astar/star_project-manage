import Link from "next/link";
import { StudioBadge } from "@/components/studio/shell";
import type { CompletedWorkItem } from "@/lib/workbench/progress";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function WorkbenchCompletedFeed({ items }: { items: CompletedWorkItem[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">最近已完成</h2>
        <p className="mt-0.5 text-xs text-slate-500">近 14 天 · 含时间、来源、项目</p>
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">近两周暂无完成记录</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={`${item.source}-${item.id}`}>
              <Link
                href={item.href}
                className="flex flex-col gap-1 py-3 transition hover:bg-slate-50/80 sm:flex-row sm:items-center sm:gap-3"
              >
                <span className="w-28 shrink-0 text-xs tabular-nums text-slate-400">
                  {formatWhen(item.completedAt)}
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium text-slate-800">
                  {item.title}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StudioBadge>{item.source === "pm" ? "PM" : "Studio"}</StudioBadge>
                  <span className="text-xs text-slate-500">{item.projectTitle}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
