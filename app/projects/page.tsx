import { WorkbenchShell } from "@/components/workbench-shell";
import { ListFilterBar } from "@/components/studio/list-filter-bar";
import { ProjectLibraryCard } from "@/components/project-library-card";
import { getAllProjects } from "@/lib/studio/data";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/studio/types";

const STATUS_ORDER: ProjectStatus[] = ["mainline", "active", "demo", "parking", "archived"];

export default async function ProjectsLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFilter } = await searchParams;
  let projects = [...(await getAllProjects())];

  if (statusFilter && STATUS_ORDER.includes(statusFilter as ProjectStatus)) {
    projects = projects.filter((p) => p.status === statusFilter);
  }

  projects.sort((a, b) => {
    const order = { mainline: 0, active: 1, demo: 2, parking: 3, archived: 4 };
    return order[a.status] - order[b.status] || a.priority.localeCompare(b.priority);
  });

  const statusOptions = STATUS_ORDER.map((status) => ({
    id: status,
    label: PROJECT_STATUS_LABELS[status],
  }));

  return (
    <WorkbenchShell title="项目库" subtitle="进入项目详情 · 恢复现场 · 需求与演进">
      <ListFilterBar
        basePath="/projects"
        currentValue={statusFilter ?? null}
        options={statusOptions}
        allLabel="全部状态"
        paramName="status"
        label="按状态"
      />

      {projects.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">没有符合筛选条件的项目</p>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <ProjectLibraryCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </WorkbenchShell>
  );
}
