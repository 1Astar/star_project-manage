import { WorkbenchShell } from "@/components/workbench-shell";
import { ProjectLibraryTable } from "@/components/project-library-table";
import {
  getAllIdeas,
  getAllProjects,
  getNextActionDrafts,
  getProjectColumnDefs,
} from "@/lib/studio/data";
import type { ProjectStatus } from "@/lib/studio/types";

const STATUS_ORDER: ProjectStatus[] = ["mainline", "active", "demo", "parking", "archived"];
const CONVERTIBLE = new Set(["inbox", "reviewing", "parked"]);

export default async function ProjectsLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
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
      subtitle="自研 / 作品 / 工作项目归档 · 多列表格可左右滑动 · 点项目名进入"
    >
      <div className="mt-2">
        <ProjectLibraryTable
          projects={projects}
          statusFilter={statusFilter ?? null}
          nextActionDrafts={nextActionDrafts}
          sourceIdeas={sourceIdeas}
          columnDefs={columnDefs}
        />
      </div>
    </WorkbenchShell>
  );
}
