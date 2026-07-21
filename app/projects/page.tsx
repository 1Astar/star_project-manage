import { Suspense } from "react";
import { WorkbenchShell } from "@/components/workbench-shell";
import { ProjectLibraryViews } from "@/components/project-library-views";
import {
  getAllIdeas,
  getAllProjects,
  getNextActionDrafts,
  getProjectColumnDefs,
} from "@/lib/studio/data";
import type { ProjectStatus } from "@/lib/studio/types";
import { toProjectTree } from "@/lib/studio/project-tree";

const STATUS_ORDER: ProjectStatus[] = ["mainline", "active", "demo", "parking", "archived"];
const CONVERTIBLE = new Set(["inbox", "reviewing", "parked"]);

export default async function ProjectsLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string }>;
}) {
  const { status: statusFilter } = await searchParams;
  const [allProjects, nextActionDrafts, allIdeas, columnDefs] = await Promise.all([
    getAllProjects(),
    getNextActionDrafts(),
    getAllIdeas(),
    getProjectColumnDefs(true),
  ]);
  let projects = [...allProjects];

  if (statusFilter && STATUS_ORDER.includes(statusFilter as ProjectStatus)) {
    projects = projects.filter((p) => p.status === statusFilter);
  }

  projects.sort((a, b) => {
    const order = { mainline: 0, active: 1, demo: 2, parking: 3, archived: 4 };
    return order[a.status] - order[b.status] || a.priority.localeCompare(b.priority);
  });

  const treeProjects = toProjectTree(projects).map((item) => item.project);

  const sourceIdeas = allIdeas
    .filter((i) => CONVERTIBLE.has(i.status) && !i.relatedProjectId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 40)
    .map((i) => ({
      id: i.id,
      title: i.title,
      oneLineIdea: i.oneLineIdea,
      whyItMatters: i.whyItMatters,
      priority: i.priority,
      suggestedNextStep: i.suggestedNextStep,
    }));

  return (
    <WorkbenchShell
      title="项目库"
      subtitle="表格可调列宽 · 左侧 + 建子项目 · 拖拽排序/挂子 · 可切看板"
    >
      <div className="mt-2">
        <Suspense fallback={<div className="h-40 rounded-xl bg-slate-50" />}>
          <ProjectLibraryViews
            projects={treeProjects}
            statusFilter={statusFilter ?? null}
            nextActionDrafts={nextActionDrafts}
            sourceIdeas={sourceIdeas}
            columnDefs={columnDefs}
          />
        </Suspense>
      </div>
    </WorkbenchShell>
  );
}
