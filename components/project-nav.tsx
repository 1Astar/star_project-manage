"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Project } from "@/lib/types";
import { ProjectSwitcher } from "@/components/project-switcher";

const NAV_ITEMS = [
  { segment: "", label: "总览" },
  { segment: "pool", label: "需求池" },
  { segment: "board", label: "需求看板" },
  { segment: "prototype", label: "原型工作区" },
  { segment: "gantt", label: "甘特图" },
  { segment: "hours", label: "工时统计" },
  { segment: "import", label: "Excel 导入" },
  { segment: "settings", label: "设置" },
] as const;

export function ProjectNav({
  projectId,
  slug,
  projects,
}: {
  projectId: string;
  slug: string;
  projects: Project[];
}) {
  const pathname = usePathname();
  const base = `/projects/${slug || projectId}`;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <ProjectSwitcher projects={projects} currentSlug={slug} />
      <nav className="flex flex-wrap gap-1">
        {NAV_ITEMS.map((item) => {
          const href = item.segment ? `${base}/${item.segment}` : base;
          const active =
            pathname === href ||
            (item.segment === "" && pathname === base) ||
            (item.segment !== "" && pathname.startsWith(`${base}/${item.segment}`));
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/"
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
        >
          全部项目
        </Link>
      </nav>
    </div>
  );
}
