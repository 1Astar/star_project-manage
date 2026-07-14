"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { suffix: "", label: "项目恢复" },
  { suffix: "/tasks", label: "需求与任务" },
  { suffix: "/prototype", label: "原型与验收" },
  { suffix: "/schedule", label: "进度排期" },
  { suffix: "/evolution", label: "迭代记录" },
  { suffix: "/resources", label: "资料链接" },
] as const;

export function ProjectNav({ routeId }: { routeId: string }) {
  const pathname = usePathname();
  const base = `/projects/${routeId}`;

  return (
    <nav className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const href = tab.suffix ? `${base}${tab.suffix}` : base;
        const active =
          tab.suffix === ""
            ? pathname === base
            : pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              "rounded-xl px-3 py-1.5 text-sm font-medium transition",
              active
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ProjectMoreMenu({ routeId, pmSlug }: { routeId: string; pmSlug: string | null }) {
  const slug = pmSlug ?? routeId;
  return (
    <details className="relative inline-block text-sm">
      <summary className="cursor-pointer list-none rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50">
        更多操作
      </summary>
      <div className="absolute right-0 z-10 mt-1 min-w-[160px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
        <a
          href={`/projects/${routeId}/secrets`}
          className="block px-3 py-2 text-slate-700 hover:bg-slate-50"
        >
          项目密钥
        </a>
        {pmSlug ? (
          <>
            <a
              href={`/projects/${slug}/import`}
              className="block px-3 py-2 text-slate-700 hover:bg-slate-50"
            >
              Excel 导入
            </a>
            <a
              href={`/projects/${slug}/settings`}
              className="block px-3 py-2 text-slate-700 hover:bg-slate-50"
            >
              项目设置
            </a>
          </>
        ) : null}
        <a href="/settings" className="block px-3 py-2 text-slate-700 hover:bg-slate-50">
          全局设置
        </a>
      </div>
    </details>
  );
}
