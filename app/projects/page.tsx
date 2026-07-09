import { WorkbenchShell } from "@/components/workbench-shell";
import { ProjectLibraryCard } from "@/components/project-library-card";
import { getAllProjects } from "@/lib/studio/data";

export default async function ProjectsLibraryPage() {
  const projects = [...(await getAllProjects())].sort((a, b) => {
    const order = { mainline: 0, active: 1, demo: 2, parking: 3, archived: 4 };
    return order[a.status] - order[b.status] || a.priority.localeCompare(b.priority);
  });

  return (
    <WorkbenchShell title="项目库" subtitle="进入项目详情 · 恢复现场 · 需求与演进">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => (
          <ProjectLibraryCard key={p.id} project={p} />
        ))}
      </div>
    </WorkbenchShell>
  );
}
