"use client";

import { useRouter } from "next/navigation";
import type { Project } from "@/lib/types";

export function ProjectSwitcher({
  projects,
  currentSlug,
}: {
  projects: Project[];
  currentSlug: string;
}) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">当前项目</span>
      <select
        className="min-w-[160px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm"
        value={currentSlug}
        onChange={(e) => {
          const slug = e.target.value;
          if (slug && slug !== currentSlug) {
            router.push(`/projects/${slug}`);
          }
        }}
      >
        {projects.map((project) => (
          <option key={project.id} value={project.slug}>
            {project.name}
          </option>
        ))}
      </select>
    </label>
  );
}
